/**
 * Parajudica Inference Engine
 *
 * Implements the fixed-point inference algorithm from the paper.
 * Given a compliance environment, computes all derived assertions
 * until reaching the least fixed point A*.
 */

// Core engine
export {
  ComplianceInferenceEngine,
  infer,
  queryAssertions,
  getLabelsForContainer,
  compareFrameworks,
  type EngineOptions,
} from "./src/engine.ts";

// Index building
export { buildIndexes, type EnvironmentIndexes } from "./src/indexes.ts";

// Condition evaluation
export {
  evaluateCondition,
  findAssertionsWithLabel,
  assertionExists,
  type EvaluationContext,
} from "./src/conditions.ts";

// Framework definitions
export * as BaseFramework from "./data/base.ts";
export * as HIPAAFramework from "./data/hipaa.ts";
export * as GDPRFramework from "./data/gdpr.ts";
export * as ItalianDPAFramework from "./data/italian-dpa.ts";

// Convenience: re-export schema types commonly needed with the engine
export type {
  ComplianceEnvironment,
  ComplianceAssertion,
  ContainmentAssertion,
  InferenceResult,
  InferenceMetrics,
  Container,
  Framework,
  Label,
  Facet,
  GovernanceScope,
  Condition,
  SubclassRule,
  EquivalenceRule,
  ImplicationRule,
  PropagationRule,
} from "@parajudica/schema";
