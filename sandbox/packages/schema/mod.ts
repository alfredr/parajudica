/**
 * Parajudica Schema
 *
 * Core types for the compliance metamodel, implementing the formal model
 * from the paper: (D, L, F, X, G, A, ⊏, ⋈)
 *
 * - D: Containers (data storage hierarchy)
 * - L: Labels (classification units)
 * - F: Frameworks (compliance interpretations)
 * - X: Facets (cross-cutting concerns)
 * - G: Governance Scopes
 * - A: Assertions (container × label × scope × framework)
 * - ⊏: Containment relation (acyclic)
 * - ⋈: Joinability relation (symmetric)
 */

// ============================================================================
// BRANDED TYPES - Type-safe identifiers
// ============================================================================

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

/** Type-safe container identifier */
export type ContainerId = Brand<string, "ContainerId">;

/** Type-safe framework identifier */
export type FrameworkId = Brand<string, "FrameworkId">;

/** Type-safe facet identifier */
export type FacetId = Brand<string, "FacetId">;

/** Type-safe label identifier */
export type LabelId = Brand<string, "LabelId">;

/** Type-safe scope identifier */
export type ScopeId = Brand<string, "ScopeId">;

/** Type-safe assertion identifier */
export type AssertionId = Brand<string, "AssertionId">;

/** Type-safe rule identifier */
export type RuleId = Brand<string, "RuleId">;

/** Factory functions for creating branded IDs */
export const Id = {
  container: (id: string): ContainerId => id as ContainerId,
  framework: (id: string): FrameworkId => id as FrameworkId,
  facet: (id: string): FacetId => id as FacetId,
  label: (id: string): LabelId => id as LabelId,
  scope: (id: string): ScopeId => id as ScopeId,
  assertion: (id: string): AssertionId => id as AssertionId,
  rule: (id: string): RuleId => id as RuleId,
} as const;

// ============================================================================
// ENUMS - Replacing magic strings
// ============================================================================

/**
 * Framework classification types.
 * Determines loading order and categorization.
 */
export enum FrameworkType {
  /** Core metamodel (pj namespace) */
  Internal = "internal",
  /** Base vocabularies and taxonomies */
  Core = "core",
  /** Privacy/compliance frameworks (GDPR, HIPAA, etc.) */
  Privacy = "privacy",
  /** User-defined frameworks */
  Custom = "custom",
}

/**
 * Propagation directions for spreading labels through the container hierarchy.
 *
 * From the paper:
 * - Inward: parent → children (GDPR style, precise)
 * - Outward: children → parent (containers containing PHI become PHI)
 * - Peer: among siblings (HIPAA expansive)
 * - Joinable: across joinableWith relationships
 */
export enum PropagationDirection {
  /** Parent label propagates to children */
  Inward = "inward",
  /** Child label propagates to parent */
  Outward = "outward",
  /** Label propagates among siblings (same parent) */
  Peer = "peer",
  /** Label propagates across joinable relationships */
  Joinable = "joinable",
}

/**
 * Container relations for condition evaluation.
 *
 * Maps to canonical relations from the paper:
 * - Self: id(x, y) := (x = y)
 * - Child: child(x, y) := (x ⊏ y)
 * - Parent: parent(x, y) := (y ⊏ x)
 * - Descendant: desc(x, y) := (x ⊏⁺ y)
 * - Ancestor: anc(x, y) := (y ⊏⁺ x)
 * - Sibling: sib(x, y) := (x ≠ y ∧ ∃p. child(x,p) ∧ child(y,p))
 */
export enum ContainerRelation {
  /** The container itself */
  Self = "self",
  /** Immediate children */
  Child = "child",
  /** Immediate parent */
  Parent = "parent",
  /** All descendants (transitive children) */
  Descendant = "descendant",
  /** All ancestors (transitive parents) */
  Ancestor = "ancestor",
  /** Siblings (same parent, excluding self) */
  Sibling = "sibling",
}

/**
 * Comparison operators for parameterized label conditions.
 */
export enum ComparisonOperator {
  LessThan = "lt",
  LessThanOrEqual = "lte",
  GreaterThan = "gt",
  GreaterThanOrEqual = "gte",
  Equal = "eq",
  NotEqual = "neq",
}

/**
 * Logical operators for composite conditions.
 */
export enum LogicalOperator {
  And = "AND",
  Or = "OR",
}

/**
 * Condition type discriminators.
 */
export enum ConditionType {
  HasLabel = "hasLabel",
  ContainsLabel = "containsLabel",
  RelationLabel = "relationLabel",
  Comparison = "comparison",
  Composite = "composite",
}

/**
 * Parameter source type for comparison conditions.
 */
export enum ParameterSourceType {
  /** Value from a label's parameter */
  LabelParameter = "labelParameter",
  /** Literal constant value */
  Literal = "literal",
}

/**
 * Parameter types for label schemas.
 */
export enum ParameterType {
  Number = "number",
  String = "string",
  Boolean = "boolean",
}

// ============================================================================
// CONTAINERS - Hierarchical data storage
// ============================================================================

/**
 * A data container in the hierarchy. Forms a forest structure where each
 * container has at most one parent. The containment relation is irreflexive
 * and acyclic.
 */
export interface Container {
  readonly id: ContainerId;
  readonly name: string;
  readonly parentId: ContainerId | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Declares that two containers can exchange data during join operations.
 * This is a symmetric relation - if A joinableWith B, then B joinableWith A.
 */
export interface JoinableRelation {
  readonly container1Id: ContainerId;
  readonly container2Id: ContainerId;
}

// ============================================================================
// FRAMEWORKS - Compliance interpretations
// ============================================================================

/**
 * A compliance framework representing a specific regulatory interpretation.
 * Frameworks can extend others, inheriting rules and label hierarchies.
 * Child frameworks may override inherited rules.
 */
export interface Framework {
  readonly id: FrameworkId;
  readonly name: string;
  readonly description?: string;
  readonly extendsId: FrameworkId | null;
  readonly type: FrameworkType;
}

// ============================================================================
// FACETS & LABELS - Classification vocabulary
// ============================================================================

/**
 * Facets organize labels into cross-cutting concerns.
 * From the paper: Subject, Identifier, Kind, Domain, Statistical, Control
 */
export interface Facet {
  readonly id: FacetId;
  readonly name: string;
  readonly frameworkId: FrameworkId;
  readonly description?: string;
}

/**
 * A compliance label - the atomic classification unit.
 * Labels belong to facets and may be parameterized.
 */
export interface Label {
  readonly id: LabelId;
  readonly name: string;
  readonly facetId: FacetId;
  readonly frameworkId: FrameworkId;
  readonly description?: string;
  /** Schema for parameterized labels (e.g., KAnonymityAnalysis has minimumCohortSize) */
  readonly parameterSchema?: Readonly<Record<string, ParameterType>>;
}

// ============================================================================
// GOVERNANCE SCOPES - Compliance environment boundaries
// ============================================================================

/**
 * A governance scope represents organizational boundaries within which
 * compliance is evaluated. Containers can appear in multiple scopes
 * simultaneously with different compliance labels in each.
 */
export interface GovernanceScope {
  readonly id: ScopeId;
  readonly name: string;
  readonly description?: string;
  /** Which containers are visible in this scope */
  readonly visibleContainerIds: readonly ContainerId[];
}

// ============================================================================
// ASSERTIONS - (container, label, scope, framework) tuples
// ============================================================================

/**
 * A compliance assertion assigning a label to a container within a scope
 * under a specific framework. This is the primary output of inference.
 *
 * Formally: (d, l, g, f) ∈ A where d ∈ D, l ∈ L, g ∈ G, f ∈ F
 */
export interface ComplianceAssertion {
  readonly id: AssertionId;
  readonly containerId: ContainerId;
  readonly labelId: LabelId;
  readonly scopeId: ScopeId;
  readonly frameworkId: FrameworkId;
  /** Parameters for parameterized labels */
  readonly parameters?: Readonly<Record<string, unknown>>;
  /** true = ground fact (initial), false = derived by inference */
  readonly isGround: boolean;
  /** Rule IDs that derived this assertion (for provenance) */
  readonly derivedFrom?: readonly RuleId[];
}

/**
 * A containment assertion tracking that a container (transitively) contains
 * a label through its descendants. Used for efficient condition evaluation.
 */
export interface ContainmentAssertion {
  readonly containerId: ContainerId;
  readonly labelId: LabelId;
  readonly scopeId: ScopeId;
  /** The descendant container that actually has the label */
  readonly sourceContainerId: ContainerId;
}

// ============================================================================
// RULES - Inference rule types
// ============================================================================

/**
 * Base interface for all rules.
 */
interface BaseRule {
  readonly id: RuleId;
  readonly frameworkId: FrameworkId;
}

/**
 * Propagation rule: when a container has label L, propagate L to related
 * containers based on direction.
 *
 * Formally: l ∈_f [d₁]_g ∧ σ(d₁, d₂) ∧ (σ, l) ∈ R_f^t ⟹ (d₂, l, g, f)
 */
export interface PropagationRule extends BaseRule {
  readonly labelId: LabelId;
  readonly direction: PropagationDirection;
}

/**
 * Subclass rule: if container has any of fromLabelIds, derive toLabelId.
 * Implements :declaresSubclassOf with :fromAnyLabel
 *
 * Formally: (l₁ → l₂) ∈ R_f^s
 */
export interface SubclassRule extends BaseRule {
  /** Any of these labels triggers the rule */
  readonly fromLabelIds: readonly LabelId[];
  readonly toLabelId: LabelId;
}

/**
 * Equivalence rule: if container has ALL of fromAllLabelIds, derive toLabelId.
 * Implements :declaresEquivalent with :fromAllLabels
 *
 * Example: UniqueCardinality ∧ OpenKnowability → DirectIdentifier
 */
export interface EquivalenceRule extends BaseRule {
  /** ALL of these labels must be present */
  readonly fromAllLabelIds: readonly LabelId[];
  readonly toLabelId: LabelId;
}

/**
 * Implication rule with optional condition.
 * Implements :declaresImplication (simple and conditional)
 *
 * Formally:
 * - Simple: (l₁ → l₂) ∈ R_f^s
 * - Conditional: (l₁ →^φ l₂) ∈ R_f^c where φ is a condition
 * - Pure: (φ ⟹ l) ∈ R_f^p where fromLabelId is null
 */
export interface ImplicationRule extends BaseRule {
  /** null for pure implications (condition alone yields label) */
  readonly fromLabelId: LabelId | null;
  readonly toLabelId: LabelId;
  /** null for simple implications */
  readonly condition: Condition | null;
}

// ============================================================================
// CONDITIONS - Condition language Γ (Discriminated Union)
// ============================================================================

/**
 * HasLabel: Check if the container itself has a specific label.
 * HasLabel_id,l(d, g) where σ = id (identity relation)
 */
export interface HasLabelCondition {
  readonly type: ConditionType.HasLabel;
  readonly labelId: LabelId;
}

/**
 * ContainsLabel: Check if the container or any descendant contains a label.
 * HasLabel_desc,l(d, g): ∃d'. desc(d', d) ∧ l ∈ [d']_g
 */
export interface ContainsLabelCondition {
  readonly type: ConditionType.ContainsLabel;
  readonly labelId: LabelId;
}

/**
 * RelationLabel: Check if a related container has a specific label.
 * HasLabel_σ,l(d, g) for various relations σ.
 */
export interface RelationLabelCondition {
  readonly type: ConditionType.RelationLabel;
  readonly relation: ContainerRelation;
  readonly labelId: LabelId;
}

/**
 * Source for comparison values.
 */
export type ParameterSource =
  | LabelParameterSource
  | LiteralParameterSource;

export interface LabelParameterSource {
  readonly sourceType: ParameterSourceType.LabelParameter;
  readonly labelId: LabelId;
  readonly parameterName: string;
  readonly defaultValue?: unknown;
}

export interface LiteralParameterSource {
  readonly sourceType: ParameterSourceType.Literal;
  readonly literalValue: unknown;
}

/**
 * Comparison: Compare parameter values.
 * Used for k-anonymity thresholds, etc.
 */
export interface ComparisonCondition {
  readonly type: ConditionType.Comparison;
  readonly left: ParameterSource;
  readonly right: ParameterSource;
  readonly operator: ComparisonOperator;
}

/**
 * Composite: Combine sub-conditions with AND/OR.
 */
export interface CompositeCondition {
  readonly type: ConditionType.Composite;
  readonly operator: LogicalOperator;
  readonly conditions: readonly Condition[];
}

/**
 * Union type of all conditions.
 */
export type Condition =
  | HasLabelCondition
  | ContainsLabelCondition
  | RelationLabelCondition
  | ComparisonCondition
  | CompositeCondition;

// ============================================================================
// COMPLETE ENVIRONMENT - Input to the inference engine
// ============================================================================

/**
 * A complete compliance environment containing all inputs for inference.
 * This is the tuple (D, G, A₀, ⊏, ⋈) from the paper plus framework definitions.
 */
export interface ComplianceEnvironment {
  // Structural elements
  readonly containers: readonly Container[];
  readonly joinableRelations: readonly JoinableRelation[];
  readonly scopes: readonly GovernanceScope[];

  // Framework vocabulary
  readonly frameworks: readonly Framework[];
  readonly facets: readonly Facet[];
  readonly labels: readonly Label[];

  // Rules (partitioned by type for efficiency)
  readonly subclassRules: readonly SubclassRule[];
  readonly equivalenceRules: readonly EquivalenceRule[];
  readonly implicationRules: readonly ImplicationRule[];
  readonly propagationRules: readonly PropagationRule[];

  // Initial assertions A₀
  readonly groundAssertions: readonly ComplianceAssertion[];
}

// ============================================================================
// INFERENCE RESULT - Output from the inference engine
// ============================================================================

/**
 * Result of running the inference engine to fixed point.
 */
export interface InferenceResult {
  /** All assertions (ground + derived) at fixed point A* */
  readonly assertions: readonly ComplianceAssertion[];
  /** Materialized containment assertions for querying */
  readonly containmentAssertions: readonly ContainmentAssertion[];
  /** Number of iterations to reach fixed point */
  readonly iterations: number;
  /** Performance metrics */
  readonly metrics: InferenceMetrics;
}

export interface InferenceMetrics {
  readonly totalTimeMs: number;
  readonly assertionsPerIteration: readonly number[];
  readonly ruleApplications: Readonly<{
    subclass: number;
    equivalence: number;
    implication: number;
    propagation: number;
  }>;
}

// ============================================================================
// KEYS & UTILITIES
// ============================================================================

/**
 * Unique key for an assertion tuple (containerId, labelId, scopeId, frameworkId).
 * Used for deduplication during inference.
 */
export type AssertionKey = Brand<string, "AssertionKey">;

export function makeAssertionKey(
  containerId: ContainerId,
  labelId: LabelId,
  scopeId: ScopeId,
  frameworkId: FrameworkId
): AssertionKey {
  return `${containerId}:${labelId}:${scopeId}:${frameworkId}` as AssertionKey;
}

/**
 * Unique key for a containment assertion (containerId, labelId, scopeId).
 */
export type ContainmentKey = Brand<string, "ContainmentKey">;

export function makeContainmentKey(
  containerId: ContainerId,
  labelId: LabelId,
  scopeId: ScopeId
): ContainmentKey {
  return `${containerId}:${labelId}:${scopeId}` as ContainmentKey;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isHasLabelCondition(c: Condition): c is HasLabelCondition {
  return c.type === ConditionType.HasLabel;
}

export function isContainsLabelCondition(c: Condition): c is ContainsLabelCondition {
  return c.type === ConditionType.ContainsLabel;
}

export function isRelationLabelCondition(c: Condition): c is RelationLabelCondition {
  return c.type === ConditionType.RelationLabel;
}

export function isComparisonCondition(c: Condition): c is ComparisonCondition {
  return c.type === ConditionType.Comparison;
}

export function isCompositeCondition(c: Condition): c is CompositeCondition {
  return c.type === ConditionType.Composite;
}

export function isLabelParameterSource(s: ParameterSource): s is LabelParameterSource {
  return s.sourceType === ParameterSourceType.LabelParameter;
}

export function isLiteralParameterSource(s: ParameterSource): s is LiteralParameterSource {
  return s.sourceType === ParameterSourceType.Literal;
}

// ============================================================================
// BUILDER HELPERS - Fluent construction of complex types
// ============================================================================

/** Helper for building conditions */
export const Conditions = {
  hasLabel: (labelId: LabelId): HasLabelCondition => ({
    type: ConditionType.HasLabel,
    labelId,
  }),

  containsLabel: (labelId: LabelId): ContainsLabelCondition => ({
    type: ConditionType.ContainsLabel,
    labelId,
  }),

  relationLabel: (
    relation: ContainerRelation,
    labelId: LabelId
  ): RelationLabelCondition => ({
    type: ConditionType.RelationLabel,
    relation,
    labelId,
  }),

  comparison: (
    left: ParameterSource,
    operator: ComparisonOperator,
    right: ParameterSource
  ): ComparisonCondition => ({
    type: ConditionType.Comparison,
    left,
    right,
    operator,
  }),

  and: (...conditions: Condition[]): CompositeCondition => ({
    type: ConditionType.Composite,
    operator: LogicalOperator.And,
    conditions,
  }),

  or: (...conditions: Condition[]): CompositeCondition => ({
    type: ConditionType.Composite,
    operator: LogicalOperator.Or,
    conditions,
  }),

  /** Helper for label parameter source */
  labelParam: (
    labelId: LabelId,
    parameterName: string,
    defaultValue?: unknown
  ): LabelParameterSource => ({
    sourceType: ParameterSourceType.LabelParameter,
    labelId,
    parameterName,
    defaultValue,
  }),

  /** Helper for literal value source */
  literal: (value: unknown): LiteralParameterSource => ({
    sourceType: ParameterSourceType.Literal,
    literalValue: value,
  }),
} as const;
