/**
 * Index structures for efficient inference operations.
 *
 * Builds lookup tables from the compliance environment to enable
 * O(1) or O(k) access patterns during fixed-point iteration.
 */

import type {
  ComplianceEnvironment,
  Container,
  Framework,
  Label,
  JoinableRelation,
  GovernanceScope,
  SubclassRule,
  EquivalenceRule,
  ImplicationRule,
  PropagationRule,
  ContainerId,
  FrameworkId,
  LabelId,
  ScopeId,
  FacetId,
} from "@parajudica/schema";

/**
 * Pre-computed indexes over the compliance environment.
 * These are built once and used throughout inference.
 */
export interface EnvironmentIndexes {
  // ========== Container Hierarchy ==========
  /** Map from container ID to container */
  readonly containers: ReadonlyMap<ContainerId, Container>;
  /** Parent ID → Child IDs (immediate children only) */
  readonly childrenOf: ReadonlyMap<ContainerId, readonly ContainerId[]>;
  /** Container ID → Descendant IDs (transitive closure of children) */
  readonly descendantsOf: ReadonlyMap<ContainerId, readonly ContainerId[]>;
  /** Container ID → Ancestor IDs (transitive closure of parents) */
  readonly ancestorsOf: ReadonlyMap<ContainerId, readonly ContainerId[]>;
  /** Container ID → Sibling IDs (same parent, excluding self) */
  readonly siblingsOf: ReadonlyMap<ContainerId, readonly ContainerId[]>;
  /** Container ID → Joinable container IDs (symmetric) */
  readonly joinableWith: ReadonlyMap<ContainerId, readonly ContainerId[]>;
  /** Root containers (no parent) */
  readonly roots: readonly ContainerId[];

  // ========== Frameworks ==========
  /** Map from framework ID to framework */
  readonly frameworks: ReadonlyMap<FrameworkId, Framework>;
  /** Framework ID → Ancestor framework IDs (for inheritance) */
  readonly frameworkAncestors: ReadonlyMap<FrameworkId, readonly FrameworkId[]>;
  /** Frameworks in topological order (parents before children) */
  readonly frameworkOrder: readonly FrameworkId[];

  // ========== Labels ==========
  /** Map from label ID to label */
  readonly labels: ReadonlyMap<LabelId, Label>;
  /** Framework ID → Label IDs defined in that framework */
  readonly labelsByFramework: ReadonlyMap<FrameworkId, readonly LabelId[]>;
  /** Facet ID → Label IDs in that facet */
  readonly labelsByFacet: ReadonlyMap<FacetId, readonly LabelId[]>;

  // ========== Scopes ==========
  /** Map from scope ID to scope */
  readonly scopes: ReadonlyMap<ScopeId, GovernanceScope>;
  /** Scope ID → Container IDs visible in that scope */
  readonly containersInScope: ReadonlyMap<ScopeId, ReadonlySet<ContainerId>>;

  // ========== Rules (by framework, for inheritance) ==========
  /** Framework ID → Subclass rules (including inherited) */
  readonly effectiveSubclassRules: ReadonlyMap<FrameworkId, readonly SubclassRule[]>;
  /** Framework ID → Equivalence rules (including inherited) */
  readonly effectiveEquivalenceRules: ReadonlyMap<FrameworkId, readonly EquivalenceRule[]>;
  /** Framework ID → Implication rules (including inherited) */
  readonly effectiveImplicationRules: ReadonlyMap<FrameworkId, readonly ImplicationRule[]>;
  /** Framework ID → Propagation rules (including inherited) */
  readonly effectivePropagationRules: ReadonlyMap<FrameworkId, readonly PropagationRule[]>;

  // ========== Rule Indexes for Fast Lookup ==========
  /** Label ID → Subclass rules that have this label in fromLabelIds */
  readonly subclassRulesByFromLabel: ReadonlyMap<LabelId, readonly SubclassRule[]>;
  /** Label ID → Implication rules that have this label as fromLabelId */
  readonly implicationRulesByFromLabel: ReadonlyMap<LabelId, readonly ImplicationRule[]>;
  /** Label ID → Propagation rules for this label */
  readonly propagationRulesByLabel: ReadonlyMap<LabelId, readonly PropagationRule[]>;
}

/**
 * Build all indexes from a compliance environment.
 * This is called once at engine initialization.
 */
export function buildIndexes(env: ComplianceEnvironment): EnvironmentIndexes {
  // ========== Container Hierarchy ==========
  const containers = new Map(env.containers.map((c) => [c.id, c]));

  const childrenOf = buildChildrenIndex(env.containers);
  const descendantsOf = buildDescendantsIndex(env.containers, childrenOf);
  const ancestorsOf = buildAncestorsIndex(env.containers, containers);
  const siblingsOf = buildSiblingsIndex(env.containers);
  const joinableWith = buildJoinableIndex(env.joinableRelations);
  const roots = env.containers
    .filter((c) => c.parentId === null)
    .map((c) => c.id);

  // ========== Frameworks ==========
  const frameworks = new Map(env.frameworks.map((f) => [f.id, f]));
  const { frameworkAncestors, frameworkOrder } = buildFrameworkHierarchy(
    env.frameworks
  );

  // ========== Labels ==========
  const labels = new Map(env.labels.map((l) => [l.id, l]));
  const labelsByFramework = groupByToIds(env.labels, (l) => l.frameworkId, (l) => l.id);
  const labelsByFacet = groupByToIds(env.labels, (l) => l.facetId, (l) => l.id);

  // ========== Scopes ==========
  const scopes = new Map(env.scopes.map((s) => [s.id, s]));
  const containersInScope = new Map(
    env.scopes.map((s) => [s.id, new Set(s.visibleContainerIds)])
  );

  // ========== Effective Rules (with inheritance) ==========
  const effectiveSubclassRules = computeEffectiveRules(
    env.subclassRules,
    frameworkOrder,
    frameworkAncestors,
    (r) => r.toLabelId // Override key: rules with same toLabelId override
  );

  const effectiveEquivalenceRules = computeEffectiveRules(
    env.equivalenceRules,
    frameworkOrder,
    frameworkAncestors,
    (r) => r.toLabelId
  );

  const effectiveImplicationRules = computeEffectiveRules(
    env.implicationRules,
    frameworkOrder,
    frameworkAncestors,
    (r) => `${r.fromLabelId ?? ""}:${r.toLabelId}`
  );

  const effectivePropagationRules = computeEffectiveRules(
    env.propagationRules,
    frameworkOrder,
    frameworkAncestors,
    (r) => `${r.labelId}:${r.direction}`
  );

  // ========== Rule Indexes ==========
  const subclassRulesByFromLabel = buildSubclassRuleIndex(env.subclassRules);
  const implicationRulesByFromLabel = buildImplicationRuleIndex(
    env.implicationRules
  );
  const propagationRulesByLabel = groupBy(
    env.propagationRules,
    (r) => r.labelId
  );

  return {
    containers,
    childrenOf,
    descendantsOf,
    ancestorsOf,
    siblingsOf,
    joinableWith,
    roots,
    frameworks,
    frameworkAncestors,
    frameworkOrder,
    labels,
    labelsByFramework,
    labelsByFacet,
    scopes,
    containersInScope,
    effectiveSubclassRules,
    effectiveEquivalenceRules,
    effectiveImplicationRules,
    effectivePropagationRules,
    subclassRulesByFromLabel,
    implicationRulesByFromLabel,
    propagationRulesByLabel,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildChildrenIndex(
  containers: readonly Container[]
): Map<ContainerId, readonly ContainerId[]> {
  const index = new Map<ContainerId, ContainerId[]>();

  for (const c of containers) {
    if (c.parentId !== null) {
      const siblings = index.get(c.parentId) ?? [];
      siblings.push(c.id);
      index.set(c.parentId, siblings);
    }
  }

  // Convert to readonly arrays
  return new Map(
    Array.from(index.entries()).map(([k, v]) => [k, Object.freeze(v)])
  );
}

function buildDescendantsIndex(
  containers: readonly Container[],
  childrenOf: ReadonlyMap<ContainerId, readonly ContainerId[]>
): Map<ContainerId, readonly ContainerId[]> {
  const index = new Map<ContainerId, readonly ContainerId[]>();

  function getDescendants(id: ContainerId): readonly ContainerId[] {
    const cached = index.get(id);
    if (cached !== undefined) return cached;

    const children = childrenOf.get(id) ?? [];
    const descendants: ContainerId[] = [...children];

    for (const childId of children) {
      descendants.push(...getDescendants(childId));
    }

    const frozen = Object.freeze(descendants);
    index.set(id, frozen);
    return frozen;
  }

  for (const c of containers) {
    getDescendants(c.id);
  }

  return index;
}

function buildAncestorsIndex(
  containers: readonly Container[],
  containerMap: ReadonlyMap<ContainerId, Container>
): Map<ContainerId, readonly ContainerId[]> {
  const index = new Map<ContainerId, readonly ContainerId[]>();

  function getAncestors(id: ContainerId): readonly ContainerId[] {
    const cached = index.get(id);
    if (cached !== undefined) return cached;

    const container = containerMap.get(id);
    if (!container || container.parentId === null) {
      const empty: readonly ContainerId[] = Object.freeze([]);
      index.set(id, empty);
      return empty;
    }

    const ancestors: ContainerId[] = [container.parentId, ...getAncestors(container.parentId)];
    const frozen = Object.freeze(ancestors);
    index.set(id, frozen);
    return frozen;
  }

  for (const c of containers) {
    getAncestors(c.id);
  }

  return index;
}

function buildSiblingsIndex(
  containers: readonly Container[]
): Map<ContainerId, readonly ContainerId[]> {
  // Group by parent
  const byParent = new Map<ContainerId | null, ContainerId[]>();
  for (const c of containers) {
    const siblings = byParent.get(c.parentId) ?? [];
    siblings.push(c.id);
    byParent.set(c.parentId, siblings);
  }

  // Build sibling index (excluding self)
  const index = new Map<ContainerId, readonly ContainerId[]>();
  for (const c of containers) {
    const siblings = (byParent.get(c.parentId) ?? []).filter(
      (id) => id !== c.id
    );
    index.set(c.id, Object.freeze(siblings));
  }

  return index;
}

function buildJoinableIndex(
  relations: readonly JoinableRelation[]
): Map<ContainerId, readonly ContainerId[]> {
  const index = new Map<ContainerId, ContainerId[]>();

  for (const rel of relations) {
    // Symmetric: add both directions
    const list1 = index.get(rel.container1Id) ?? [];
    list1.push(rel.container2Id);
    index.set(rel.container1Id, list1);

    const list2 = index.get(rel.container2Id) ?? [];
    list2.push(rel.container1Id);
    index.set(rel.container2Id, list2);
  }

  return new Map(
    Array.from(index.entries()).map(([k, v]) => [k, Object.freeze(v)])
  );
}

function buildFrameworkHierarchy(frameworks: readonly Framework[]): {
  frameworkAncestors: Map<FrameworkId, readonly FrameworkId[]>;
  frameworkOrder: readonly FrameworkId[];
} {
  const frameworkMap = new Map(frameworks.map((f) => [f.id, f]));
  const ancestors = new Map<FrameworkId, readonly FrameworkId[]>();

  function getAncestors(id: FrameworkId): readonly FrameworkId[] {
    const cached = ancestors.get(id);
    if (cached !== undefined) return cached;

    const framework = frameworkMap.get(id);
    if (!framework || framework.extendsId === null) {
      const empty: readonly FrameworkId[] = Object.freeze([]);
      ancestors.set(id, empty);
      return empty;
    }

    const result: FrameworkId[] = [framework.extendsId, ...getAncestors(framework.extendsId)];
    const frozen = Object.freeze(result);
    ancestors.set(id, frozen);
    return frozen;
  }

  for (const f of frameworks) {
    getAncestors(f.id);
  }

  // Topological sort (parents before children)
  const visited = new Set<FrameworkId>();
  const order: FrameworkId[] = [];

  function visit(id: FrameworkId) {
    if (visited.has(id)) return;
    const framework = frameworkMap.get(id);
    if (framework?.extendsId) {
      visit(framework.extendsId);
    }
    visited.add(id);
    order.push(id);
  }

  for (const f of frameworks) {
    visit(f.id);
  }

  return {
    frameworkAncestors: ancestors,
    frameworkOrder: Object.freeze(order),
  };
}

/**
 * Compute effective rules for each framework, including inherited rules.
 * Child frameworks override inherited rules based on the override key.
 */
function computeEffectiveRules<T extends { frameworkId: FrameworkId; id: unknown }>(
  rules: readonly T[],
  frameworkOrder: readonly FrameworkId[],
  frameworkAncestors: ReadonlyMap<FrameworkId, readonly FrameworkId[]>,
  getOverrideKey: (rule: T) => string
): Map<FrameworkId, readonly T[]> {
  // Group rules by framework
  const rulesByFramework = groupBy(rules, (r) => r.frameworkId);

  // For each framework, compute effective rules
  const effective = new Map<FrameworkId, readonly T[]>();

  for (const frameworkId of frameworkOrder) {
    const declaredRules = rulesByFramework.get(frameworkId) ?? [];
    const ancestorIds = frameworkAncestors.get(frameworkId) ?? [];

    // Collect all inherited rules
    const inheritedRules: T[] = [];
    for (const ancestorId of ancestorIds) {
      const ancestorEffective = effective.get(ancestorId) ?? [];
      inheritedRules.push(...ancestorEffective);
    }

    // Determine which inherited rules are overridden
    const declaredKeys = new Set(declaredRules.map(getOverrideKey));
    const keptInherited = inheritedRules.filter(
      (r) => !declaredKeys.has(getOverrideKey(r))
    );

    // Combine declared + non-overridden inherited
    const effectiveRules = [...declaredRules, ...keptInherited];
    effective.set(frameworkId, Object.freeze(effectiveRules));
  }

  return effective;
}

function buildSubclassRuleIndex(
  rules: readonly SubclassRule[]
): Map<LabelId, readonly SubclassRule[]> {
  const index = new Map<LabelId, SubclassRule[]>();

  for (const rule of rules) {
    for (const labelId of rule.fromLabelIds) {
      const list = index.get(labelId) ?? [];
      list.push(rule);
      index.set(labelId, list);
    }
  }

  return new Map(
    Array.from(index.entries()).map(([k, v]) => [k, Object.freeze(v)])
  );
}

function buildImplicationRuleIndex(
  rules: readonly ImplicationRule[]
): Map<LabelId, readonly ImplicationRule[]> {
  const index = new Map<LabelId, ImplicationRule[]>();

  for (const rule of rules) {
    if (rule.fromLabelId !== null) {
      const list = index.get(rule.fromLabelId) ?? [];
      list.push(rule);
      index.set(rule.fromLabelId, list);
    }
  }

  return new Map(
    Array.from(index.entries()).map(([k, v]) => [k, Object.freeze(v)])
  );
}

/**
 * Group items by a key function.
 */
function groupBy<T, K extends string>(
  items: readonly T[],
  keyFn: (item: T) => K
): Map<K, readonly T[]> {
  const groups = new Map<K, T[]>();

  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  return new Map(
    Array.from(groups.entries()).map(([k, v]) => [k, Object.freeze(v)])
  );
}

/**
 * Group items by a key function, extracting only IDs.
 */
function groupByToIds<T, K extends string, V extends string>(
  items: readonly T[],
  keyFn: (item: T) => K,
  idFn: (item: T) => V
): Map<K, readonly V[]> {
  const groups = new Map<K, V[]>();

  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) ?? [];
    group.push(idFn(item));
    groups.set(key, group);
  }

  return new Map(
    Array.from(groups.entries()).map(([k, v]) => [k, Object.freeze(v)])
  );
}
