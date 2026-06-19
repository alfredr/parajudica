/**
 * Italian DPA Framework
 *
 * From the paper: "The Italian DPA applies a stricter GDPR interpretation,
 * treating ANY unique information about individuals as personal data.
 * While GDPR requires both cardinality and knowability for identifiability,
 * the Italian DPA considers uniqueness alone sufficient."
 *
 * Key difference: Internal UUIDs with ClosedKnowability become PersonalData
 * under Italian rules, whereas standard GDPR would not classify them as such.
 *
 * This framework draws on Article 29 Working Party guidance (WP29) and
 * specifically rejects singling out: datasets remain personal data whenever
 * unique identifiers enable individual distinction, regardless of actual
 * re-identification risk.
 */

import {
  type Framework,
  type Label,
  type SubclassRule,
  type ImplicationRule,
  type PropagationRule,
  type EquivalenceRule,
  FrameworkType,
  ContainerRelation,
  Conditions,
  Id,
} from "@parajudica/schema";
import { LABEL_IDS as BASE_LABELS, FACET_IDS as BASE_FACETS } from "./base.ts";
import { FRAMEWORK_ID as GDPR_ID, LABEL_IDS as GDPR_LABELS } from "./gdpr.ts";

// ============================================================================
// FRAMEWORK
// ============================================================================

export const FRAMEWORK_ID = Id.framework("italian-dpa");

export const framework: Framework = {
  id: FRAMEWORK_ID,
  name: "Italian DPA Interpretation",
  description:
    "Stricter GDPR interpretation per Italian Data Protection Authority. " +
    "Uniqueness alone triggers personal data classification (no knowability requirement). " +
    "Based on WP29 anonymization guidance rejecting singling out.",
  extendsId: GDPR_ID,
  type: FrameworkType.Privacy,
};

export const frameworks: Framework[] = [framework];

// ============================================================================
// LABELS
// ============================================================================

export const LABEL_IDS = {
  // Italian DPA specific labels
  SingledOutData: Id.label("italian-dpa:SingledOutData"),
  AnonymizationRejected: Id.label("italian-dpa:AnonymizationRejected"),
} as const;

export const labels: Label[] = [
  {
    id: LABEL_IDS.SingledOutData,
    name: "Singled Out Data",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description:
      "Data enabling individual distinction regardless of re-identification risk",
  },
  {
    id: LABEL_IDS.AnonymizationRejected,
    name: "Anonymization Rejected",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description:
      "Data that cannot be considered anonymous under Italian DPA interpretation",
  },
];

// ============================================================================
// SUBCLASS RULES
// ============================================================================

/**
 * Singled out data is personal data under Italian DPA.
 */
export const subclassRules: SubclassRule[] = [
  {
    id: Id.rule("italian-dpa:SingledOut-is-PersonalData"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [LABEL_IDS.SingledOutData],
    toLabelId: GDPR_LABELS.PersonalData,
  },
  // Internal identifiers (Unique + Closed) are also personal data
  // This overrides the GDPR rule that requires OpenKnowability
  {
    id: Id.rule("italian-dpa:InternalIdentifier-is-PersonalData"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [BASE_LABELS.InternalIdentifier],
    toLabelId: GDPR_LABELS.PersonalData,
  },
];

// ============================================================================
// EQUIVALENCE RULES
// ============================================================================

export const equivalenceRules: EquivalenceRule[] = [];

// ============================================================================
// IMPLICATION RULES
// ============================================================================

/**
 * Italian DPA interpretation rules.
 *
 * From Figure 7 in the paper:
 * 1. Individual + UniqueCardinality → PersonalData
 *    (regardless of knowability)
 * 2. UniqueCardinality + Individual → PersonalData
 *    (bidirectional rule for completeness)
 */
export const implicationRules: ImplicationRule[] = [
  // Individual + contains UniqueCardinality → PersonalData
  // This is stricter than GDPR which requires OpenKnowability
  {
    id: Id.rule("italian-dpa:Individual-Unique-implies-PersonalData"),
    frameworkId: FRAMEWORK_ID,
    fromLabelId: BASE_LABELS.Individual,
    toLabelId: GDPR_LABELS.PersonalData,
    condition: Conditions.containsLabel(BASE_LABELS.UniqueCardinality),
  },

  // UniqueCardinality + has Individual → PersonalData
  // (reverse direction)
  {
    id: Id.rule("italian-dpa:Unique-Individual-implies-PersonalData"),
    frameworkId: FRAMEWORK_ID,
    fromLabelId: BASE_LABELS.UniqueCardinality,
    toLabelId: GDPR_LABELS.PersonalData,
    condition: Conditions.relationLabel(ContainerRelation.Self, BASE_LABELS.Individual),
  },

  // Any unique identifier enables singling out
  {
    id: Id.rule("italian-dpa:Unique-implies-SingledOut"),
    frameworkId: FRAMEWORK_ID,
    fromLabelId: BASE_LABELS.UniqueCardinality,
    toLabelId: LABEL_IDS.SingledOutData,
    condition: Conditions.containsLabel(BASE_LABELS.Individual),
  },

  // Internal identifiers (closed knowability) still enable singling out
  {
    id: Id.rule("italian-dpa:InternalID-implies-SingledOut"),
    frameworkId: FRAMEWORK_ID,
    fromLabelId: BASE_LABELS.InternalIdentifier,
    toLabelId: LABEL_IDS.SingledOutData,
    condition: Conditions.containsLabel(BASE_LABELS.Individual),
  },

  // K-anonymized data is STILL personal data under Italian DPA
  // (risk-based methods are rejected)
  {
    id: Id.rule("italian-dpa:KAnonymity-rejected"),
    frameworkId: FRAMEWORK_ID,
    fromLabelId: BASE_LABELS.KAnonymityAnalysis,
    toLabelId: LABEL_IDS.AnonymizationRejected,
    condition: Conditions.containsLabel(BASE_LABELS.Individual),
  },

  // Anonymization rejected → Personal data
  {
    id: Id.rule("italian-dpa:AnonymizationRejected-implies-PersonalData"),
    frameworkId: FRAMEWORK_ID,
    fromLabelId: LABEL_IDS.AnonymizationRejected,
    toLabelId: GDPR_LABELS.PersonalData,
    condition: null,
  },
];

// ============================================================================
// PROPAGATION RULES
// ============================================================================

/**
 * Italian DPA inherits GDPR's inward-only propagation.
 * No additional propagation rules needed.
 */
export const propagationRules: PropagationRule[] = [];

// ============================================================================
// FACETS
// ============================================================================

export const facets: never[] = []; // Uses base facets
