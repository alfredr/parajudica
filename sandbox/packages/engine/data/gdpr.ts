/**
 * GDPR Framework
 *
 * From the paper: "This framework distinguishes data about individuals from
 * data that identifies them. The Individual label marks persistent
 * characteristics, while PersonalData requires linkage with identifiers.
 * Removing identifiers preserves Individual but eliminates PersonalData."
 *
 * Key differences from HIPAA:
 * - Propagation is strictly INWARD (maintains field-level precision)
 * - Hierarchy: HealthData ⊂ SpecialCategoryData ⊂ PersonalData
 * - Medical codes become health data only with identifiers in healthcare contexts
 *
 * Includes EMA (European Medicines Agency) sub-framework with stricter k < 12 threshold.
 */

import {
  type Framework,
  type Facet,
  type Label,
  type SubclassRule,
  type EquivalenceRule,
  type ImplicationRule,
  type PropagationRule,
  FrameworkType,
  PropagationDirection,
  ConditionType,
  ComparisonOperator,
  ParameterSourceType,
  ParameterType,
  Conditions,
  Id,
} from "@parajudica/schema";
import { FRAMEWORK_ID as BASE_ID, LABEL_IDS as BASE_LABELS, FACET_IDS as BASE_FACETS } from "./base.ts";

// ============================================================================
// FRAMEWORK IDs
// ============================================================================

export const FRAMEWORK_ID = Id.framework("gdpr");
export const EMA_FRAMEWORK_ID = Id.framework("gdpr:ema");

// ============================================================================
// FRAMEWORKS
// ============================================================================

export const framework: Framework = {
  id: FRAMEWORK_ID,
  name: "GDPR",
  description:
    "General Data Protection Regulation. Distinguishes data about individuals " +
    "from data that identifies them. Uses inward-only propagation.",
  extendsId: BASE_ID,
  type: FrameworkType.Privacy,
};

export const emaFramework: Framework = {
  id: EMA_FRAMEWORK_ID,
  name: "EMA Policy 0070",
  description:
    "European Medicines Agency guidance for clinical trial data publication. " +
    "Extends GDPR with stricter k >= 12 threshold for public release.",
  extendsId: FRAMEWORK_ID,
  type: FrameworkType.Privacy,
};

export const frameworks: Framework[] = [framework, emaFramework];

// ============================================================================
// FACETS
// ============================================================================

export const facets: Facet[] = []; // Uses base facets

// ============================================================================
// LABELS
// ============================================================================

export const LABEL_IDS = {
  // Core GDPR labels
  PersonalData: Id.label("gdpr:PersonalData"),
  SpecialCategoryData: Id.label("gdpr:SpecialCategoryData"),
  DataConcerningHealth: Id.label("gdpr:DataConcerningHealth"),
  AnonymousData: Id.label("gdpr:AnonymousData"),
  PseudonymousData: Id.label("gdpr:PseudonymousData"),

  // Additional special categories (Article 9)
  RacialOrEthnicOrigin: Id.label("gdpr:RacialOrEthnicOrigin"),
  PoliticalOpinions: Id.label("gdpr:PoliticalOpinions"),
  ReligiousBeliefs: Id.label("gdpr:ReligiousBeliefs"),
  TradeUnionMembership: Id.label("gdpr:TradeUnionMembership"),
  GeneticData: Id.label("gdpr:GeneticData"),
  BiometricDataForID: Id.label("gdpr:BiometricDataForID"),
  SexLifeOrOrientation: Id.label("gdpr:SexLifeOrOrientation"),

  // EMA specific labels
  EMAHighReidentificationRisk: Id.label("ema:HighReidentificationRisk"),
  EMALowReidentificationRisk: Id.label("ema:LowReidentificationRisk"),
  EMAReleaseApproved: Id.label("ema:ReleaseApproved"),
} as const;

export const labels: Label[] = [
  // ========== Core GDPR Labels ==========
  {
    id: LABEL_IDS.PersonalData,
    name: "Personal Data",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description:
      "Any information relating to an identified or identifiable natural person (Article 4(1))",
  },
  {
    id: LABEL_IDS.SpecialCategoryData,
    name: "Special Category Data",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description:
      "Sensitive personal data requiring additional protections (Article 9)",
  },
  {
    id: LABEL_IDS.DataConcerningHealth,
    name: "Data Concerning Health",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description:
      "Personal data related to physical or mental health (Article 4(15))",
  },
  {
    id: LABEL_IDS.AnonymousData,
    name: "Anonymous Data",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description:
      "Information which does not relate to an identified or identifiable natural person (Recital 26)",
  },
  {
    id: LABEL_IDS.PseudonymousData,
    name: "Pseudonymous Data",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description:
      "Personal data processed so it cannot be attributed to a specific data subject without additional information (Article 4(5))",
  },

  // ========== Special Category Labels (Article 9) ==========
  {
    id: LABEL_IDS.RacialOrEthnicOrigin,
    name: "Racial or Ethnic Origin",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description: "Data revealing racial or ethnic origin",
  },
  {
    id: LABEL_IDS.PoliticalOpinions,
    name: "Political Opinions",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description: "Data revealing political opinions",
  },
  {
    id: LABEL_IDS.ReligiousBeliefs,
    name: "Religious or Philosophical Beliefs",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description: "Data revealing religious or philosophical beliefs",
  },
  {
    id: LABEL_IDS.TradeUnionMembership,
    name: "Trade Union Membership",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description: "Data revealing trade union membership",
  },
  {
    id: LABEL_IDS.GeneticData,
    name: "Genetic Data",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description: "Personal data relating to inherited or acquired genetic characteristics",
  },
  {
    id: LABEL_IDS.BiometricDataForID,
    name: "Biometric Data for ID",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description: "Biometric data processed for uniquely identifying a natural person",
  },
  {
    id: LABEL_IDS.SexLifeOrOrientation,
    name: "Sex Life or Sexual Orientation",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description: "Data concerning a person's sex life or sexual orientation",
  },

  // ========== EMA Labels ==========
  {
    id: LABEL_IDS.EMAHighReidentificationRisk,
    name: "EMA High Re-identification Risk",
    facetId: BASE_FACETS.Statistical,
    frameworkId: EMA_FRAMEWORK_ID,
    description: "Data with high re-identification risk per EMA Policy 0070 (k < 12)",
  },
  {
    id: LABEL_IDS.EMALowReidentificationRisk,
    name: "EMA Low Re-identification Risk",
    facetId: BASE_FACETS.Statistical,
    frameworkId: EMA_FRAMEWORK_ID,
    description: "Data with low re-identification risk per EMA Policy 0070 (k >= 12)",
  },
  {
    id: LABEL_IDS.EMAReleaseApproved,
    name: "EMA Release Approved",
    facetId: BASE_FACETS.Control,
    frameworkId: EMA_FRAMEWORK_ID,
    description: "Data approved for public release under EMA Policy 0070",
  },
];

// ============================================================================
// SUBCLASS RULES
// ============================================================================

/**
 * GDPR hierarchy:
 * DataConcerningHealth ⊂ SpecialCategoryData ⊂ PersonalData
 *
 * All Article 9 categories are subclasses of SpecialCategoryData.
 */
export const subclassRules: SubclassRule[] = [
  // Health data → Special category
  {
    id: Id.rule("gdpr:HealthData-is-SpecialCategory"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [LABEL_IDS.DataConcerningHealth],
    toLabelId: LABEL_IDS.SpecialCategoryData,
  },
  // All Article 9 categories → Special category
  {
    id: Id.rule("gdpr:Article9-is-SpecialCategory"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [
      LABEL_IDS.RacialOrEthnicOrigin,
      LABEL_IDS.PoliticalOpinions,
      LABEL_IDS.ReligiousBeliefs,
      LABEL_IDS.TradeUnionMembership,
      LABEL_IDS.GeneticData,
      LABEL_IDS.BiometricDataForID,
      LABEL_IDS.SexLifeOrOrientation,
    ],
    toLabelId: LABEL_IDS.SpecialCategoryData,
  },
  // Special category → Personal data
  {
    id: Id.rule("gdpr:SpecialCategory-is-PersonalData"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [LABEL_IDS.SpecialCategoryData],
    toLabelId: LABEL_IDS.PersonalData,
  },
  // Pseudonymous data is still personal data
  {
    id: Id.rule("gdpr:Pseudonymous-is-PersonalData"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [LABEL_IDS.PseudonymousData],
    toLabelId: LABEL_IDS.PersonalData,
  },
  // Medical data kinds → Health data (when in healthcare context, handled by implication)
  {
    id: Id.rule("gdpr:MedicalKinds-is-HealthData"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [
      BASE_LABELS.DiagnosisCode,
      BASE_LABELS.ProcedureCode,
      BASE_LABELS.MedicationData,
      BASE_LABELS.LabResult,
      BASE_LABELS.VitalSign,
    ],
    toLabelId: LABEL_IDS.DataConcerningHealth,
  },
  // Biometric data → Biometric data for ID (when used for identification)
  {
    id: Id.rule("gdpr:Biometric-base-to-gdpr"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [BASE_LABELS.BiometricData, BASE_LABELS.FaceImage],
    toLabelId: LABEL_IDS.BiometricDataForID,
  },
  // Ethnicity → Racial/ethnic origin
  {
    id: Id.rule("gdpr:Ethnicity-to-RacialOrigin"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [BASE_LABELS.Ethnicity],
    toLabelId: LABEL_IDS.RacialOrEthnicOrigin,
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
 * GDPR: Personal data requires Individual + Identifier linkage.
 *
 * From the paper: "The Individual label marks persistent characteristics,
 * while PersonalData requires linkage with identifiers."
 */
export const implicationRules: ImplicationRule[] = [
  // Individual + Identifier → Personal Data
  // From Figure 5: "Individual + contains IdentifierData → PersonalData"
  {
    id: Id.rule("gdpr:Individual-Identifier-implies-PersonalData"),
    frameworkId: FRAMEWORK_ID,
    fromLabelId: BASE_LABELS.Individual,
    toLabelId: LABEL_IDS.PersonalData,
    condition: Conditions.containsLabel(BASE_LABELS.IdentifierData),
  },

  // Healthcare + Individual + Identifier → Health Data
  // Medical codes become health data only with identifiers in healthcare contexts
  {
    id: Id.rule("gdpr:Healthcare-Individual-implies-HealthData"),
    frameworkId: FRAMEWORK_ID,
    fromLabelId: BASE_LABELS.Healthcare,
    toLabelId: LABEL_IDS.DataConcerningHealth,
    condition: Conditions.and(
      Conditions.containsLabel(BASE_LABELS.Individual),
      Conditions.containsLabel(BASE_LABELS.IdentifierData)
    ),
  },

  // EMA: k < 12 → High re-identification risk
  // From Figure 5: "EMA extends GDPR with k < 12 threshold"
  {
    id: Id.rule("ema:HighRisk-k12"),
    frameworkId: EMA_FRAMEWORK_ID,
    fromLabelId: BASE_LABELS.KAnonymityAnalysis,
    toLabelId: LABEL_IDS.EMAHighReidentificationRisk,
    condition: {
      type: ConditionType.Comparison,
      left: {
        sourceType: ParameterSourceType.LabelParameter,
        labelId: BASE_LABELS.KAnonymityAnalysis,
        parameterName: "minimumCohortSize",
      },
      right: {
        sourceType: ParameterSourceType.Literal,
        literalValue: 12,
      },
      operator: ComparisonOperator.LessThan,
    },
  },

  // EMA: k >= 12 → Low re-identification risk → Release approved
  {
    id: Id.rule("ema:LowRisk-k12"),
    frameworkId: EMA_FRAMEWORK_ID,
    fromLabelId: BASE_LABELS.KAnonymityAnalysis,
    toLabelId: LABEL_IDS.EMALowReidentificationRisk,
    condition: {
      type: ConditionType.Comparison,
      left: {
        sourceType: ParameterSourceType.LabelParameter,
        labelId: BASE_LABELS.KAnonymityAnalysis,
        parameterName: "minimumCohortSize",
      },
      right: {
        sourceType: ParameterSourceType.Literal,
        literalValue: 12,
      },
      operator: ComparisonOperator.GreaterThanOrEqual,
    },
  },

  // EMA: Low risk → Release approved
  {
    id: Id.rule("ema:LowRisk-implies-ReleaseApproved"),
    frameworkId: EMA_FRAMEWORK_ID,
    fromLabelId: LABEL_IDS.EMALowReidentificationRisk,
    toLabelId: LABEL_IDS.EMAReleaseApproved,
    condition: null, // No additional condition
  },

  // EMA: High risk prevents release (implies still PersonalData)
  {
    id: Id.rule("ema:HighRisk-implies-PersonalData"),
    frameworkId: EMA_FRAMEWORK_ID,
    fromLabelId: LABEL_IDS.EMAHighReidentificationRisk,
    toLabelId: LABEL_IDS.PersonalData,
    condition: null,
  },
];

// ============================================================================
// PROPAGATION RULES
// ============================================================================

/**
 * GDPR uses INWARD-ONLY propagation to maintain field-level precision.
 *
 * From the paper: "GDPR's inward-only propagation preserves field-level
 * precision: PatientTreatments carries HealthData while sibling
 * ProvidersInfo remains PersonalData."
 */
export const propagationRules: PropagationRule[] = [
  // Personal data propagates inward only
  {
    id: Id.rule("gdpr:PersonalData-propagate-inward"),
    frameworkId: FRAMEWORK_ID,
    labelId: LABEL_IDS.PersonalData,
    direction: PropagationDirection.Inward,
  },
  // Special category propagates inward only
  {
    id: Id.rule("gdpr:SpecialCategory-propagate-inward"),
    frameworkId: FRAMEWORK_ID,
    labelId: LABEL_IDS.SpecialCategoryData,
    direction: PropagationDirection.Inward,
  },
  // Health data propagates inward only
  {
    id: Id.rule("gdpr:HealthData-propagate-inward"),
    frameworkId: FRAMEWORK_ID,
    labelId: LABEL_IDS.DataConcerningHealth,
    direction: PropagationDirection.Inward,
  },
];
