/**
 * Condition Evaluation
 *
 * Implements the condition language Γ from the paper, closed under ∧ and ∨.
 * Evaluates conditions in the context of a container, scope, and current
 * assertion state.
 */

import {
  type Condition,
  type HasLabelCondition,
  type ContainsLabelCondition,
  type RelationLabelCondition,
  type ComparisonCondition,
  type CompositeCondition,
  type ParameterSource,
  type ComplianceAssertion,
  type AssertionKey,
  type ContainerId,
  type LabelId,
  type ScopeId,
  type FrameworkId,
  ConditionType,
  ContainerRelation,
  ComparisonOperator,
  LogicalOperator,
  ParameterSourceType,
  makeAssertionKey,
} from "@parajudica/schema";
import type { EnvironmentIndexes } from "./indexes.ts";

/**
 * Context for condition evaluation.
 * Provides access to the current assertion state and environment indexes.
 */
export interface EvaluationContext {
  /** Current assertion state (keyed by assertion tuple) */
  readonly assertions: ReadonlyMap<AssertionKey, ComplianceAssertion>;
  /** Environment indexes for container/framework lookups */
  readonly indexes: EnvironmentIndexes;
  /** The container being evaluated */
  readonly containerId: ContainerId;
  /** The scope being evaluated in */
  readonly scopeId: ScopeId;
  /** The framework context for the rule */
  readonly frameworkId: FrameworkId;
}

/**
 * Evaluate a condition in the given context.
 * Returns true if the condition is satisfied.
 */
export function evaluateCondition(
  condition: Condition,
  ctx: EvaluationContext
): boolean {
  switch (condition.type) {
    case ConditionType.HasLabel:
      return evaluateHasLabel(condition, ctx);
    case ConditionType.ContainsLabel:
      return evaluateContainsLabel(condition, ctx);
    case ConditionType.RelationLabel:
      return evaluateRelationLabel(condition, ctx);
    case ConditionType.Comparison:
      return evaluateComparison(condition, ctx);
    case ConditionType.Composite:
      return evaluateComposite(condition, ctx);
  }
}

/**
 * HasLabel: Check if the container itself has a specific label.
 *
 * HasLabel_id,l(d, g) := l ∈ [d]_g
 */
function evaluateHasLabel(
  condition: HasLabelCondition,
  ctx: EvaluationContext
): boolean {
  // Check if there's an assertion for this container + label + scope
  // Must check all frameworks in the inheritance chain
  const frameworkChain = getFrameworkChain(ctx.frameworkId, ctx.indexes);

  for (const fwId of frameworkChain) {
    const key = makeAssertionKey(
      ctx.containerId,
      condition.labelId,
      ctx.scopeId,
      fwId
    );
    if (ctx.assertions.has(key)) {
      return true;
    }
  }

  return false;
}

/**
 * ContainsLabel: Check if the container or any descendant contains a label.
 *
 * HasLabel_desc,l(d, g) := ∃d'. desc(d', d) ∧ l ∈ [d']_g
 *
 * This checks the container itself and all descendants.
 */
function evaluateContainsLabel(
  condition: ContainsLabelCondition,
  ctx: EvaluationContext
): boolean {
  // Check self
  if (hasLabelInFrameworkChain(ctx.containerId, condition.labelId, ctx)) {
    return true;
  }

  // Check all descendants
  const descendants = ctx.indexes.descendantsOf.get(ctx.containerId) ?? [];
  for (const descId of descendants) {
    if (hasLabelInFrameworkChain(descId, condition.labelId, ctx)) {
      return true;
    }
  }

  return false;
}

/**
 * RelationLabel: Check if a related container has a specific label.
 *
 * HasLabel_σ,l(d, g) := ∃d'. σ(d', d) ∧ l ∈ [d']_g
 */
function evaluateRelationLabel(
  condition: RelationLabelCondition,
  ctx: EvaluationContext
): boolean {
  const relatedIds = getRelatedContainers(
    ctx.containerId,
    condition.relation,
    ctx.indexes
  );

  for (const relatedId of relatedIds) {
    if (hasLabelInFrameworkChain(relatedId, condition.labelId, ctx)) {
      return true;
    }
  }

  return false;
}

/**
 * Comparison: Compare parameter values.
 *
 * Used for k-anonymity thresholds, e.g.:
 *   KAnonymityAnalysis.minimumCohortSize < ExpertDeterminationThreshold.kThreshold
 */
function evaluateComparison(
  condition: ComparisonCondition,
  ctx: EvaluationContext
): boolean {
  const leftValue = resolveParameterSource(condition.left, ctx);
  const rightValue = resolveParameterSource(condition.right, ctx);

  if (leftValue === undefined || rightValue === undefined) {
    return false;
  }

  return compareValues(leftValue, rightValue, condition.operator);
}

/**
 * Composite: Combine sub-conditions with AND/OR.
 */
function evaluateComposite(
  condition: CompositeCondition,
  ctx: EvaluationContext
): boolean {
  switch (condition.operator) {
    case LogicalOperator.And:
      return condition.conditions.every((c) => evaluateCondition(c, ctx));
    case LogicalOperator.Or:
      return condition.conditions.some((c) => evaluateCondition(c, ctx));
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the framework inheritance chain (self + all ancestors).
 */
function getFrameworkChain(
  frameworkId: FrameworkId,
  indexes: EnvironmentIndexes
): readonly FrameworkId[] {
  const ancestors = indexes.frameworkAncestors.get(frameworkId) ?? [];
  return [frameworkId, ...ancestors];
}

/**
 * Check if a container has a label, considering framework inheritance.
 */
function hasLabelInFrameworkChain(
  containerId: ContainerId,
  labelId: LabelId,
  ctx: EvaluationContext
): boolean {
  const frameworkChain = getFrameworkChain(ctx.frameworkId, ctx.indexes);

  for (const fwId of frameworkChain) {
    const key = makeAssertionKey(containerId, labelId, ctx.scopeId, fwId);
    if (ctx.assertions.has(key)) {
      return true;
    }
  }

  return false;
}

/**
 * Get containers related to a given container by the specified relation.
 */
function getRelatedContainers(
  containerId: ContainerId,
  relation: ContainerRelation,
  indexes: EnvironmentIndexes
): readonly ContainerId[] {
  switch (relation) {
    case ContainerRelation.Self:
      return [containerId];

    case ContainerRelation.Child:
      return indexes.childrenOf.get(containerId) ?? [];

    case ContainerRelation.Parent: {
      const container = indexes.containers.get(containerId);
      return container?.parentId ? [container.parentId] : [];
    }

    case ContainerRelation.Descendant:
      return indexes.descendantsOf.get(containerId) ?? [];

    case ContainerRelation.Ancestor:
      return indexes.ancestorsOf.get(containerId) ?? [];

    case ContainerRelation.Sibling:
      return indexes.siblingsOf.get(containerId) ?? [];
  }
}

/**
 * Resolve a parameter source to a concrete value.
 */
function resolveParameterSource(
  source: ParameterSource,
  ctx: EvaluationContext
): unknown {
  switch (source.sourceType) {
    case ParameterSourceType.Literal:
      return source.literalValue;

    case ParameterSourceType.LabelParameter: {
      const frameworkChain = getFrameworkChain(ctx.frameworkId, ctx.indexes);

      // Look for an assertion with this label on this container
      for (const fwId of frameworkChain) {
        const key = makeAssertionKey(
          ctx.containerId,
          source.labelId,
          ctx.scopeId,
          fwId
        );
        const assertion = ctx.assertions.get(key);
        if (assertion?.parameters?.[source.parameterName] !== undefined) {
          return assertion.parameters[source.parameterName];
        }
      }

      // Also check descendants for the label (containment semantics)
      const descendants = ctx.indexes.descendantsOf.get(ctx.containerId) ?? [];
      for (const descId of descendants) {
        for (const fwId of frameworkChain) {
          const key = makeAssertionKey(descId, source.labelId, ctx.scopeId, fwId);
          const assertion = ctx.assertions.get(key);
          if (assertion?.parameters?.[source.parameterName] !== undefined) {
            return assertion.parameters[source.parameterName];
          }
        }
      }

      return source.defaultValue;
    }
  }
}

/**
 * Compare two values with the given operator.
 */
function compareValues(
  left: unknown,
  right: unknown,
  operator: ComparisonOperator
): boolean {
  // Handle numeric comparisons
  if (typeof left === "number" && typeof right === "number") {
    switch (operator) {
      case ComparisonOperator.LessThan:
        return left < right;
      case ComparisonOperator.LessThanOrEqual:
        return left <= right;
      case ComparisonOperator.GreaterThan:
        return left > right;
      case ComparisonOperator.GreaterThanOrEqual:
        return left >= right;
      case ComparisonOperator.Equal:
        return left === right;
      case ComparisonOperator.NotEqual:
        return left !== right;
    }
  }

  // Handle string comparisons
  if (typeof left === "string" && typeof right === "string") {
    switch (operator) {
      case ComparisonOperator.LessThan:
        return left < right;
      case ComparisonOperator.LessThanOrEqual:
        return left <= right;
      case ComparisonOperator.GreaterThan:
        return left > right;
      case ComparisonOperator.GreaterThanOrEqual:
        return left >= right;
      case ComparisonOperator.Equal:
        return left === right;
      case ComparisonOperator.NotEqual:
        return left !== right;
    }
  }

  // For equality/inequality, use strict comparison
  switch (operator) {
    case ComparisonOperator.Equal:
      return left === right;
    case ComparisonOperator.NotEqual:
      return left !== right;
    default:
      // Cannot compare non-numeric/non-string values with ordering operators
      return false;
  }
}

// ============================================================================
// ADDITIONAL QUERY HELPERS
// ============================================================================

/**
 * Find all assertions matching a label pattern in the current state.
 * Useful for rule application.
 */
export function findAssertionsWithLabel(
  labelId: LabelId,
  scopeId: ScopeId,
  frameworkId: FrameworkId,
  assertions: ReadonlyMap<AssertionKey, ComplianceAssertion>,
  indexes: EnvironmentIndexes
): ComplianceAssertion[] {
  const results: ComplianceAssertion[] = [];
  const frameworkChain = getFrameworkChain(frameworkId, indexes);

  // Iterate through all containers in scope
  const containersInScope = indexes.containersInScope.get(scopeId);
  if (!containersInScope) return results;

  for (const containerId of containersInScope) {
    for (const fwId of frameworkChain) {
      const key = makeAssertionKey(containerId, labelId, scopeId, fwId);
      const assertion = assertions.get(key);
      if (assertion) {
        results.push(assertion);
      }
    }
  }

  return results;
}

/**
 * Check if an assertion already exists (for deduplication).
 */
export function assertionExists(
  containerId: ContainerId,
  labelId: LabelId,
  scopeId: ScopeId,
  frameworkId: FrameworkId,
  assertions: ReadonlyMap<AssertionKey, ComplianceAssertion>
): boolean {
  const key = makeAssertionKey(containerId, labelId, scopeId, frameworkId);
  return assertions.has(key);
}
