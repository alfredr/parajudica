/**
 * HIPAA Framework
 *
 * From the paper: "This framework extends the Base Control facet to implement
 * the Privacy Rule, introducing concepts centered on Protected Health
 * Information (PHI). It applies expansive propagation: inward, outward,
 * peer, and joinable."
 *
 * Includes two de-identification sub-frameworks:
 * - Safe Harbor: removes 18 enumerated identifiers
 * - Expert Determination: statistical evidence of "very small" re-identification risk
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
  ContainerRelation,
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

export const FRAMEWORK_ID = Id.framework("hipaa");
export const SAFE_HARBOR_ID = Id.framework("hipaa:safeHarbor");
export const EXPERT_DETERMINATION_ID = Id.framework("hipaa:expertDetermination");

// ============================================================================
// FRAMEWORKS
// ============================================================================

export const framework: Framework = {
  id: FRAMEWORK_ID,
  name: "HIPAA",
  description:
    "Health Insurance Portability and Accountability Act Privacy Rule. " +
    "Implements PHI classification with expansive propagation semantics.",
  extendsId: BASE_ID,
  type: FrameworkType.Privacy,
};

export const safeHarborFramework: Framework = {
  id: SAFE_HARBOR_ID,
  name: "HIPAA Safe Harbor",
  description:
    "Safe Harbor de-identification method (45 C.F.R. § 164.514(b)(2)). " +
    "Removes 18 enumerated identifier types.",
  extendsId: FRAMEWORK_ID,
  type: FrameworkType.Privacy,
};

export const expertDeterminationFramework: Framework = {
  id: EXPERT_DETERMINATION_ID,
  name: "HIPAA Expert Determination",
  description:
    "Expert Determination de-identification method (45 C.F.R. § 164.514(b)(1)). " +
    'Uses statistical evidence of "very small" re-identification risk.',
  extendsId: FRAMEWORK_ID,
  type: FrameworkType.Privacy,
};

export const frameworks: Framework[] = [
  framework,
  safeHarborFramework,
  expertDeterminationFramework,
];

// ============================================================================
// FACETS (extends Base Control facet)
// ============================================================================

export const facets: Facet[] = []; // Uses base facets

// ============================================================================
// LABELS
// ============================================================================

export const LABEL_IDS = {
  // Core HIPAA labels
  ProtectedHealthInformation: Id.label("hipaa:ProtectedHealthInformation"),
  HIPAAIdentifier: Id.label("hipaa:HIPAAIdentifier"),
  DeidentifiedData: Id.label("hipaa:DeidentifiedData"),
  LimitedDataSet: Id.label("hipaa:LimitedDataSet"),

  // Safe Harbor specific
  SafeHarborIdentifier: Id.label("hipaa:SafeHarborIdentifier"),
  SafeHarborCompliant: Id.label("hipaa:SafeHarborCompliant"),

  // Expert Determination specific
  ExpertDeterminationThreshold: Id.label("hipaa:ExpertDeterminationThreshold"),
  HighReidentificationRisk: Id.label("hipaa:HighReidentificationRisk"),
  LowReidentificationRisk: Id.label("hipaa:LowReidentificationRisk"),
} as const;

export const labels: Label[] = [
  // ========== Core HIPAA Labels ==========
  {
    id: LABEL_IDS.ProtectedHealthInformation,
    name: "Protected Health Information (PHI)",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description:
      "Individually identifiable health information held by a covered entity",
  },
  {
    id: LABEL_IDS.HIPAAIdentifier,
    name: "HIPAA Identifier",
    facetId: BASE_FACETS.Identifier,
    frameworkId: FRAMEWORK_ID,
    description: "Identifier type recognized under HIPAA",
  },
  {
    id: LABEL_IDS.DeidentifiedData,
    name: "De-identified Data",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description:
      "Data that has been de-identified per HIPAA standards (outside HIPAA scope)",
  },
  {
    id: LABEL_IDS.LimitedDataSet,
    name: "Limited Data Set",
    facetId: BASE_FACETS.Control,
    frameworkId: FRAMEWORK_ID,
    description:
      "PHI with direct identifiers removed (still requires data use agreement)",
  },

  // ========== Safe Harbor Labels ==========
  {
    id: LABEL_IDS.SafeHarborIdentifier,
    name: "Safe Harbor Identifier",
    facetId: BASE_FACETS.Identifier,
    frameworkId: SAFE_HARBOR_ID,
    description: "One of the 18 identifier types enumerated in Safe Harbor",
  },
  {
    id: LABEL_IDS.SafeHarborCompliant,
    name: "Safe Harbor Compliant",
    facetId: BASE_FACETS.Control,
    frameworkId: SAFE_HARBOR_ID,
    description:
      "Data that is compliant with Safe Harbor de-identification requirements",
  },

  // ========== Expert Determination Labels ==========
  {
    id: LABEL_IDS.ExpertDeterminationThreshold,
    name: "Expert Determination Threshold",
    facetId: BASE_FACETS.Statistical,
    frameworkId: EXPERT_DETERMINATION_ID,
    description: "Configurable k-anonymity threshold for Expert Determination",
    parameterSchema: {
      kThreshold: ParameterType.Number, // Default: 3
    },
  },
  {
    id: LABEL_IDS.HighReidentificationRisk,
    name: "High Re-identification Risk",
    facetId: BASE_FACETS.Statistical,
    frameworkId: EXPERT_DETERMINATION_ID,
    description: "Data with high re-identification risk (k < threshold)",
  },
  {
    id: LABEL_IDS.LowReidentificationRisk,
    name: "Low Re-identification Risk",
    facetId: BASE_FACETS.Statistical,
    frameworkId: EXPERT_DETERMINATION_ID,
    description: "Data with low re-identification risk (k >= threshold)",
  },
];

// ============================================================================
// SUBCLASS RULES
// ============================================================================

/**
 * Safe Harbor: 18 identifier types that must be removed.
 * From Figure 4 in the paper.
 */
export const subclassRules: SubclassRule[] = [
  // All 18 Safe Harbor identifiers
  {
    id: Id.rule("hipaa:SafeHarborIdentifiers"),
    frameworkId: SAFE_HARBOR_ID,
    fromLabelIds: [
      BASE_LABELS.Name,
      BASE_LABELS.Address,
      BASE_LABELS.MomentData,
      BASE_LABELS.Phone,
      BASE_LABELS.Fax,
      BASE_LABELS.Email,
      BASE_LABELS.SSN,
      BASE_LABELS.MedicalRecordNumber,
      BASE_LABELS.HealthPlanNumber,
      BASE_LABELS.AccountNumber,
      BASE_LABELS.CertificateNumber,
      BASE_LABELS.VehicleIdentifier,
      BASE_LABELS.DeviceIdentifier,
      BASE_LABELS.WebURL,
      BASE_LABELS.IPAddress,
      BASE_LABELS.BiometricData,
      BASE_LABELS.FaceImage,
      BASE_LABELS.UniqueID,
    ],
    toLabelId: LABEL_IDS.SafeHarborIdentifier,
  },
  // Safe Harbor identifiers are HIPAA identifiers
  {
    id: Id.rule("hipaa:SafeHarbor-is-HIPAAIdentifier"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [LABEL_IDS.SafeHarborIdentifier],
    toLabelId: LABEL_IDS.HIPAAIdentifier,
  },
  // Direct identifiers are HIPAA identifiers
  {
    id: Id.rule("hipaa:DirectIdentifier-is-HIPAAIdentifier"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [BASE_LABELS.DirectIdentifier],
    toLabelId: LABEL_IDS.HIPAAIdentifier,
  },
  // High re-identification risk implies PHI in healthcare context
  {
    id: Id.rule("hipaa:HighRisk-is-HIPAAIdentifier"),
    frameworkId: EXPERT_DETERMINATION_ID,
    fromLabelIds: [LABEL_IDS.HighReidentificationRisk],
    toLabelId: LABEL_IDS.HIPAAIdentifier,
  },
];

// ============================================================================
// EQUIVALENCE RULES
// ============================================================================

export const equivalenceRules: EquivalenceRule[] = [];

// ============================================================================
// IMPLICATION RULES
// ============================================================================

export const implicationRules: ImplicationRule[] = [
  // Healthcare + Identifier → PHI
  // "Healthcare data becomes PHI through conditional implication: any container
  // labeled Healthcare that contains either HIPAAIdentifier or PHI receives PHI status."
  {
    id: Id.rule("hipaa:Healthcare-Identifier-implies-PHI"),
    frameworkId: FRAMEWORK_ID,
    fromLabelId: BASE_LABELS.Healthcare,
    toLabelId: LABEL_IDS.ProtectedHealthInformation,
    condition: Conditions.or(
      Conditions.containsLabel(LABEL_IDS.HIPAAIdentifier),
      Conditions.containsLabel(LABEL_IDS.ProtectedHealthInformation)
    ),
  },

  // Individual + Healthcare + Identifier → PHI
  {
    id: Id.rule("hipaa:Individual-Healthcare-Identifier-implies-PHI"),
    frameworkId: FRAMEWORK_ID,
    fromLabelId: BASE_LABELS.Individual,
    toLabelId: LABEL_IDS.ProtectedHealthInformation,
    condition: Conditions.and(
      Conditions.relationLabel(ContainerRelation.Self, BASE_LABELS.Healthcare),
      Conditions.containsLabel(LABEL_IDS.HIPAAIdentifier)
    ),
  },

  // Expert Determination: k < threshold → High Re-identification Risk
  // From Figure 4: "flags high re-identification risk when k < 3"
  {
    id: Id.rule("hipaa:ExpertDetermination-HighRisk"),
    frameworkId: EXPERT_DETERMINATION_ID,
    fromLabelId: BASE_LABELS.KAnonymityAnalysis,
    toLabelId: LABEL_IDS.HighReidentificationRisk,
    condition: {
      type: ConditionType.Comparison,
      left: {
        sourceType: ParameterSourceType.LabelParameter,
        labelId: BASE_LABELS.KAnonymityAnalysis,
        parameterName: "minimumCohortSize",
      },
      right: {
        sourceType: ParameterSourceType.LabelParameter,
        labelId: LABEL_IDS.ExpertDeterminationThreshold,
        parameterName: "kThreshold",
        defaultValue: 3, // Default threshold per OCR guidance
      },
      operator: ComparisonOperator.LessThan,
    },
  },

  // Expert Determination: k >= threshold → Low Re-identification Risk
  {
    id: Id.rule("hipaa:ExpertDetermination-LowRisk"),
    frameworkId: EXPERT_DETERMINATION_ID,
    fromLabelId: BASE_LABELS.KAnonymityAnalysis,
    toLabelId: LABEL_IDS.LowReidentificationRisk,
    condition: {
      type: ConditionType.Comparison,
      left: {
        sourceType: ParameterSourceType.LabelParameter,
        labelId: BASE_LABELS.KAnonymityAnalysis,
        parameterName: "minimumCohortSize",
      },
      right: {
        sourceType: ParameterSourceType.LabelParameter,
        labelId: LABEL_IDS.ExpertDeterminationThreshold,
        parameterName: "kThreshold",
        defaultValue: 3,
      },
      operator: ComparisonOperator.GreaterThanOrEqual,
    },
  },
];

// ============================================================================
// PROPAGATION RULES
// ============================================================================

/**
 * HIPAA applies expansive propagation for PHI:
 * - Inward: PHI status propagates to contained fields
 * - Outward: Containers containing PHI are themselves PHI
 * - Peer: PHI propagates among siblings
 * - Joinable: PHI spreads across joinable relationships
 *
 * From the paper: "HIPAA's transitive approach... the entire dataset becomes PHI,
 * since employee identifiers inherit PHI status through association."
 */
export const propagationRules: PropagationRule[] = [
  // PHI propagates in all four directions
  {
    id: Id.rule("hipaa:PHI-propagate-inward"),
    frameworkId: FRAMEWORK_ID,
    labelId: LABEL_IDS.ProtectedHealthInformation,
    direction: PropagationDirection.Inward,
  },
  {
    id: Id.rule("hipaa:PHI-propagate-outward"),
    frameworkId: FRAMEWORK_ID,
    labelId: LABEL_IDS.ProtectedHealthInformation,
    direction: PropagationDirection.Outward,
  },
  {
    id: Id.rule("hipaa:PHI-propagate-peer"),
    frameworkId: FRAMEWORK_ID,
    labelId: LABEL_IDS.ProtectedHealthInformation,
    direction: PropagationDirection.Peer,
  },
  {
    id: Id.rule("hipaa:PHI-propagate-joinable"),
    frameworkId: FRAMEWORK_ID,
    labelId: LABEL_IDS.ProtectedHealthInformation,
    direction: PropagationDirection.Joinable,
  },

  // HIPAA Identifier also propagates outward (container becomes identifiable)
  {
    id: Id.rule("hipaa:HIPAAIdentifier-propagate-outward"),
    frameworkId: FRAMEWORK_ID,
    labelId: LABEL_IDS.HIPAAIdentifier,
    direction: PropagationDirection.Outward,
  },
];
