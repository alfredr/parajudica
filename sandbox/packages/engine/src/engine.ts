/**
 * Compliance Inference Engine
 *
 * Implements the fixed-point inference algorithm from the paper.
 * Given a compliance environment, computes all derived assertions
 * until reaching the least fixed point A*.
 *
 * Algorithm:
 *   A⁰ = A₀ (ground assertions)
 *   Aⁱ⁺¹ = T(Aⁱ) = Aⁱ ∪ {τ : Aⁱ ⊢ τ}
 *   Continue until Aⁱ⁺¹ = Aⁱ (fixed point)
 *
 * Per Theorem 1, this converges in polynomial time since:
 * - U = D × L × G × F is finite
 * - All rules are positive (monotonic)
 */

import {
  type ComplianceEnvironment,
  type ComplianceAssertion,
  type ContainmentAssertion,
  type InferenceResult,
  type InferenceMetrics,
  type AssertionKey,
  type ContainerId,
  type LabelId,
  type ScopeId,
  type FrameworkId,
  type RuleId,
  type AssertionId,
  PropagationDirection,
  Id,
  makeAssertionKey,
  makeContainmentKey,
} from "@parajudica/schema";
import { buildIndexes, type EnvironmentIndexes } from "./indexes.ts";
import { evaluateCondition, type EvaluationContext } from "./conditions.ts";

/**
 * Configuration options for the inference engine.
 */
export interface EngineOptions {
  /** Maximum iterations before forced termination (safety limit) */
  readonly maxIterations?: number;
  /** Enable detailed timing metrics */
  readonly enableMetrics?: boolean;
  /** Callback for progress reporting */
  readonly onProgress?: (iteration: number, newAssertions: number) => void;
}

const DEFAULT_OPTIONS: Required<EngineOptions> = {
  maxIterations: 1000,
  enableMetrics: true,
  onProgress: () => {},
};

/**
 * The main compliance inference engine.
 *
 * Usage:
 * ```ts
 * const engine = new ComplianceInferenceEngine(environment);
 * const result = engine.infer();
 * ```
 */
export class ComplianceInferenceEngine {
  private readonly env: ComplianceEnvironment;
  private readonly indexes: EnvironmentIndexes;
  private readonly options: Required<EngineOptions>;

  // Mutable state during inference
  private assertions: Map<AssertionKey, ComplianceAssertion>;
  private assertionCounter: number;

  // Metrics tracking
  private metrics: {
    subclass: number;
    equivalence: number;
    implication: number;
    propagation: number;
  };

  constructor(env: ComplianceEnvironment, options: EngineOptions = {}) {
    this.env = env;
    this.indexes = buildIndexes(env);
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.assertions = new Map();
    this.assertionCounter = 0;
    this.metrics = { subclass: 0, equivalence: 0, implication: 0, propagation: 0 };
  }

  /**
   * Run inference to fixed point.
   * Returns all assertions (ground + derived) at convergence.
   */
  infer(): InferenceResult {
    const startTime = performance.now();
    const assertionsPerIteration: number[] = [];

    // Initialize with ground assertions
    this.loadGroundAssertions();
    assertionsPerIteration.push(this.assertions.size);

    let iterations = 0;
    let changed = true;

    while (changed && iterations < this.options.maxIterations) {
      changed = false;
      iterations++;

      const beforeCount = this.assertions.size;

      // Apply rules in dependency order (important for correctness)
      // 1. Subclass rules (label hierarchy)
      changed = this.applySubclassRules() || changed;

      // 2. Equivalence rules (conjunction of labels)
      changed = this.applyEquivalenceRules() || changed;

      // 3. Implication rules (with condition evaluation)
      changed = this.applyImplicationRules() || changed;

      // 4. Propagation rules (spread labels through hierarchy)
      changed = this.applyPropagationRules() || changed;

      const afterCount = this.assertions.size;
      assertionsPerIteration.push(afterCount);

      this.options.onProgress(iterations, afterCount - beforeCount);
    }

    if (iterations >= this.options.maxIterations) {
      console.warn(
        `Inference hit maximum iterations (${this.options.maxIterations}). ` +
          `Result may be incomplete.`
      );
    }

    // Build containment assertions
    const containmentAssertions = this.buildContainmentAssertions();

    const totalTimeMs = performance.now() - startTime;

    const result: InferenceResult = {
      assertions: Array.from(this.assertions.values()),
      containmentAssertions,
      iterations,
      metrics: {
        totalTimeMs,
        assertionsPerIteration,
        ruleApplications: { ...this.metrics },
      },
    };

    return result;
  }

  /**
   * Get the current assertion state (for inspection during debugging).
   */
  getAssertions(): ReadonlyMap<AssertionKey, ComplianceAssertion> {
    return this.assertions;
  }

  /**
   * Get the built indexes (for inspection during debugging).
   */
  getIndexes(): EnvironmentIndexes {
    return this.indexes;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private loadGroundAssertions(): void {
    for (const assertion of this.env.groundAssertions) {
      const key = makeAssertionKey(
        assertion.containerId,
        assertion.labelId,
        assertion.scopeId,
        assertion.frameworkId
      );
      this.assertions.set(key, assertion);
    }
  }

  // ============================================================================
  // RULE APPLICATION
  // ============================================================================

  /**
   * Apply subclass rules: if container has any of fromLabelIds, derive toLabelId.
   */
  private applySubclassRules(): boolean {
    let changed = false;

    // For each framework
    for (const frameworkId of this.indexes.frameworkOrder) {
      const rules = this.indexes.effectiveSubclassRules.get(frameworkId) ?? [];

      // For each scope
      for (const scopeId of this.indexes.scopes.keys()) {
        const containersInScope = this.indexes.containersInScope.get(scopeId);
        if (!containersInScope) continue;

        // For each container in scope
        for (const containerId of containersInScope) {
          // For each rule
          for (const rule of rules) {
            // Check if container has any of the from labels (considering inheritance)
            const hasFromLabel = rule.fromLabelIds.some((fromLabelId) =>
              this.hasLabelInFrameworkChain(containerId, fromLabelId, scopeId, frameworkId)
            );

            if (hasFromLabel) {
              if (
                this.addDerivedAssertion(
                  containerId,
                  rule.toLabelId,
                  scopeId,
                  frameworkId,
                  [rule.id]
                )
              ) {
                changed = true;
                this.metrics.subclass++;
              }
            }
          }
        }
      }
    }

    return changed;
  }

  /**
   * Apply equivalence rules: if container has ALL of fromAllLabelIds, derive toLabelId.
   */
  private applyEquivalenceRules(): boolean {
    let changed = false;

    for (const frameworkId of this.indexes.frameworkOrder) {
      const rules = this.indexes.effectiveEquivalenceRules.get(frameworkId) ?? [];

      for (const scopeId of this.indexes.scopes.keys()) {
        const containersInScope = this.indexes.containersInScope.get(scopeId);
        if (!containersInScope) continue;

        for (const containerId of containersInScope) {
          for (const rule of rules) {
            // Check if container has ALL of the from labels (considering inheritance)
            const hasAllLabels = rule.fromAllLabelIds.every((fromLabelId) =>
              this.hasLabelInFrameworkChain(containerId, fromLabelId, scopeId, frameworkId)
            );

            if (hasAllLabels) {
              if (
                this.addDerivedAssertion(
                  containerId,
                  rule.toLabelId,
                  scopeId,
                  frameworkId,
                  [rule.id]
                )
              ) {
                changed = true;
                this.metrics.equivalence++;
              }
            }
          }
        }
      }
    }

    return changed;
  }

  /**
   * Apply implication rules with condition evaluation.
   */
  private applyImplicationRules(): boolean {
    let changed = false;

    for (const frameworkId of this.indexes.frameworkOrder) {
      const rules = this.indexes.effectiveImplicationRules.get(frameworkId) ?? [];

      for (const scopeId of this.indexes.scopes.keys()) {
        const containersInScope = this.indexes.containersInScope.get(scopeId);
        if (!containersInScope) continue;

        for (const containerId of containersInScope) {
          for (const rule of rules) {
            // Check precondition (if any) - considering framework inheritance
            if (rule.fromLabelId !== null) {
              if (!this.hasLabelInFrameworkChain(containerId, rule.fromLabelId, scopeId, frameworkId)) {
                continue; // Precondition not met
              }
            }

            // Evaluate condition (if any)
            if (rule.condition !== null) {
              const ctx: EvaluationContext = {
                assertions: this.assertions,
                indexes: this.indexes,
                containerId,
                scopeId,
                frameworkId,
              };

              if (!evaluateCondition(rule.condition, ctx)) {
                continue; // Condition not satisfied
              }
            }

            // Derive the target label
            if (
              this.addDerivedAssertion(
                containerId,
                rule.toLabelId,
                scopeId,
                frameworkId,
                [rule.id]
              )
            ) {
              changed = true;
              this.metrics.implication++;
            }
          }
        }
      }
    }

    return changed;
  }

  /**
   * Apply propagation rules to spread labels through the hierarchy.
   */
  private applyPropagationRules(): boolean {
    let changed = false;

    for (const frameworkId of this.indexes.frameworkOrder) {
      const rules = this.indexes.effectivePropagationRules.get(frameworkId) ?? [];

      for (const rule of rules) {
        // Find all assertions with this label in this framework
        for (const [key, assertion] of this.assertions) {
          if (
            assertion.labelId !== rule.labelId ||
            assertion.frameworkId !== frameworkId
          ) {
            continue;
          }

          // Get propagation targets based on direction
          const targets = this.getPropagationTargets(
            assertion.containerId,
            rule.direction
          );

          for (const targetId of targets) {
            // Only propagate within the same scope
            const containersInScope = this.indexes.containersInScope.get(
              assertion.scopeId
            );
            if (!containersInScope?.has(targetId)) {
              continue; // Target not in scope
            }

            if (
              this.addDerivedAssertion(
                targetId,
                rule.labelId,
                assertion.scopeId,
                frameworkId,
                [rule.id]
              )
            ) {
              changed = true;
              this.metrics.propagation++;
            }
          }
        }
      }
    }

    return changed;
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Check if a container has a label, considering framework inheritance.
   * A framework can see labels asserted by itself or any ancestor framework.
   */
  private hasLabelInFrameworkChain(
    containerId: ContainerId,
    labelId: LabelId,
    scopeId: ScopeId,
    frameworkId: FrameworkId
  ): boolean {
    // Get the framework inheritance chain (self + ancestors)
    const ancestors = this.indexes.frameworkAncestors.get(frameworkId) ?? [];
    const frameworkChain = [frameworkId, ...ancestors];

    for (const fwId of frameworkChain) {
      const key = makeAssertionKey(containerId, labelId, scopeId, fwId);
      if (this.assertions.has(key)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get propagation target containers based on direction.
   */
  private getPropagationTargets(
    containerId: ContainerId,
    direction: PropagationDirection
  ): readonly ContainerId[] {
    switch (direction) {
      case PropagationDirection.Inward:
        return this.indexes.childrenOf.get(containerId) ?? [];

      case PropagationDirection.Outward: {
        const container = this.indexes.containers.get(containerId);
        return container?.parentId ? [container.parentId] : [];
      }

      case PropagationDirection.Peer:
        return this.indexes.siblingsOf.get(containerId) ?? [];

      case PropagationDirection.Joinable:
        return this.indexes.joinableWith.get(containerId) ?? [];
    }
  }

  /**
   * Add a derived assertion if it doesn't already exist.
   * Returns true if the assertion was newly added.
   */
  private addDerivedAssertion(
    containerId: ContainerId,
    labelId: LabelId,
    scopeId: ScopeId,
    frameworkId: FrameworkId,
    derivedFrom: RuleId[]
  ): boolean {
    const key = makeAssertionKey(containerId, labelId, scopeId, frameworkId);

    if (this.assertions.has(key)) {
      return false; // Already exists
    }

    const assertion: ComplianceAssertion = {
      id: Id.assertion(`derived-${++this.assertionCounter}`),
      containerId,
      labelId,
      scopeId,
      frameworkId,
      isGround: false,
      derivedFrom,
    };

    this.assertions.set(key, assertion);
    return true;
  }

  /**
   * Build containment assertions for efficient querying.
   * A containment assertion says "container C contains label L (via descendant D)".
   */
  private buildContainmentAssertions(): ContainmentAssertion[] {
    const containments: ContainmentAssertion[] = [];
    const seen = new Set<string>();

    for (const assertion of this.assertions.values()) {
      // For each ancestor of this container, create a containment assertion
      const ancestors =
        this.indexes.ancestorsOf.get(assertion.containerId) ?? [];

      for (const ancestorId of ancestors) {
        const key = makeContainmentKey(
          ancestorId,
          assertion.labelId,
          assertion.scopeId
        );

        if (!seen.has(key)) {
          seen.add(key);
          containments.push({
            containerId: ancestorId,
            labelId: assertion.labelId,
            scopeId: assertion.scopeId,
            sourceContainerId: assertion.containerId,
          });
        }
      }
    }

    return containments;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Run inference on an environment and return results.
 * Convenience wrapper around ComplianceInferenceEngine.
 */
export function infer(
  env: ComplianceEnvironment,
  options?: EngineOptions
): InferenceResult {
  const engine = new ComplianceInferenceEngine(env, options);
  return engine.infer();
}

/**
 * Query assertions by various criteria.
 */
export function queryAssertions(
  result: InferenceResult,
  query: {
    containerId?: ContainerId;
    labelId?: LabelId;
    scopeId?: ScopeId;
    frameworkId?: FrameworkId;
    isGround?: boolean;
  }
): ComplianceAssertion[] {
  return result.assertions.filter((a) => {
    if (query.containerId !== undefined && a.containerId !== query.containerId) {
      return false;
    }
    if (query.labelId !== undefined && a.labelId !== query.labelId) {
      return false;
    }
    if (query.scopeId !== undefined && a.scopeId !== query.scopeId) {
      return false;
    }
    if (query.frameworkId !== undefined && a.frameworkId !== query.frameworkId) {
      return false;
    }
    if (query.isGround !== undefined && a.isGround !== query.isGround) {
      return false;
    }
    return true;
  });
}

/**
 * Get all labels for a specific container in a scope.
 */
export function getLabelsForContainer(
  result: InferenceResult,
  containerId: ContainerId,
  scopeId: ScopeId
): Map<FrameworkId, LabelId[]> {
  const byFramework = new Map<FrameworkId, LabelId[]>();

  for (const assertion of result.assertions) {
    if (
      assertion.containerId === containerId &&
      assertion.scopeId === scopeId
    ) {
      const labels = byFramework.get(assertion.frameworkId) ?? [];
      labels.push(assertion.labelId);
      byFramework.set(assertion.frameworkId, labels);
    }
  }

  return byFramework;
}

/**
 * Compare labels across frameworks for a container (for divergence analysis).
 */
export function compareFrameworks(
  result: InferenceResult,
  containerId: ContainerId,
  scopeId: ScopeId
): {
  framework: FrameworkId;
  labels: LabelId[];
}[] {
  const labelsByFramework = getLabelsForContainer(result, containerId, scopeId);

  return Array.from(labelsByFramework.entries()).map(([framework, labels]) => ({
    framework,
    labels,
  }));
}
