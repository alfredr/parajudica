/**
 * Base Framework
 *
 * From the paper: "The Base framework establishes a six-facet taxonomy:
 * Subject, Identifier, Kind, Domain, Statistical, and Control."
 *
 * This provides foundational vocabularies and classification logic
 * that subsequent frameworks extend and specialize.
 */

import {
  type Framework,
  type Facet,
  type Label,
  type SubclassRule,
  type EquivalenceRule,
  type PropagationRule,
  FrameworkType,
  PropagationDirection,
  ParameterType,
  Id,
} from "@parajudica/schema";

// ============================================================================
// FRAMEWORK
// ============================================================================

export const FRAMEWORK_ID = Id.framework("base");

export const framework: Framework = {
  id: FRAMEWORK_ID,
  name: "Base Framework",
  description:
    "Foundational taxonomies and classification logic. " +
    "Establishes Subject, Identifier, Kind, Domain, Statistical, and Control facets.",
  extendsId: null, // Root framework
  type: FrameworkType.Core,
};

// ============================================================================
// FACETS
// ============================================================================

export const FACET_IDS = {
  Subject: Id.facet("base:Subject"),
  Identifier: Id.facet("base:Identifier"),
  Kind: Id.facet("base:Kind"),
  Domain: Id.facet("base:Domain"),
  Statistical: Id.facet("base:Statistical"),
  Control: Id.facet("base:Control"),
} as const;

export const facets: Facet[] = [
  {
    id: FACET_IDS.Subject,
    name: "Subject",
    frameworkId: FRAMEWORK_ID,
    description: "Categorizes entities (Individual, Organization)",
  },
  {
    id: FACET_IDS.Identifier,
    name: "Identifier",
    frameworkId: FRAMEWORK_ID,
    description: "Derives classifications from Cardinality × Knowability",
  },
  {
    id: FACET_IDS.Kind,
    name: "Kind",
    frameworkId: FRAMEWORK_ID,
    description: "Organizes semantic types with multi-inheritance",
  },
  {
    id: FACET_IDS.Domain,
    name: "Domain",
    frameworkId: FRAMEWORK_ID,
    description: "Specifies operational context (Healthcare, Financial, etc.)",
  },
  {
    id: FACET_IDS.Statistical,
    name: "Statistical",
    frameworkId: FRAMEWORK_ID,
    description: "Enables quantitative analysis (k-anonymity, etc.)",
  },
  {
    id: FACET_IDS.Control,
    name: "Control",
    frameworkId: FRAMEWORK_ID,
    description: "Namespace for regulatory framework classifications",
  },
];

// ============================================================================
// LABELS
// ============================================================================

export const LABEL_IDS = {
  // Subject facet
  Individual: Id.label("base:Individual"),
  Organization: Id.label("base:Organization"),

  // Identifier facet - Cardinality
  UniqueCardinality: Id.label("base:UniqueCardinality"),
  ClosedGroupCardinality: Id.label("base:ClosedGroupCardinality"),
  OpenGroupCardinality: Id.label("base:OpenGroupCardinality"),

  // Identifier facet - Knowability
  OpenKnowability: Id.label("base:OpenKnowability"),
  ClosedKnowability: Id.label("base:ClosedKnowability"),

  // Identifier facet - Derived types
  DirectIdentifier: Id.label("base:DirectIdentifier"),
  InternalIdentifier: Id.label("base:InternalIdentifier"),
  IndirectIdentifier: Id.label("base:IndirectIdentifier"),
  IdentifierData: Id.label("base:IdentifierData"),

  // Kind facet - Common data kinds
  Name: Id.label("base:Name"),
  Address: Id.label("base:Address"),
  Phone: Id.label("base:Phone"),
  Email: Id.label("base:Email"),
  SSN: Id.label("base:SSN"),
  MedicalRecordNumber: Id.label("base:MedicalRecordNumber"),
  HealthPlanNumber: Id.label("base:HealthPlanNumber"),
  AccountNumber: Id.label("base:AccountNumber"),
  CertificateNumber: Id.label("base:CertificateNumber"),
  VehicleIdentifier: Id.label("base:VehicleIdentifier"),
  DeviceIdentifier: Id.label("base:DeviceIdentifier"),
  WebURL: Id.label("base:WebURL"),
  IPAddress: Id.label("base:IPAddress"),
  BiometricData: Id.label("base:BiometricData"),
  FaceImage: Id.label("base:FaceImage"),
  UniqueID: Id.label("base:UniqueID"),
  MomentData: Id.label("base:MomentData"), // Date-related data
  Fax: Id.label("base:Fax"),

  // Kind facet - Medical data
  DiagnosisCode: Id.label("base:DiagnosisCode"),
  ProcedureCode: Id.label("base:ProcedureCode"),
  MedicationData: Id.label("base:MedicationData"),
  LabResult: Id.label("base:LabResult"),
  VitalSign: Id.label("base:VitalSign"),

  // Kind facet - Demographics
  Age: Id.label("base:Age"),
  Gender: Id.label("base:Gender"),
  Ethnicity: Id.label("base:Ethnicity"),
  DateOfBirth: Id.label("base:DateOfBirth"),

  // Domain facet
  Healthcare: Id.label("base:Healthcare"),
  Financial: Id.label("base:Financial"),
  Employment: Id.label("base:Employment"),
  Research: Id.label("base:Research"),

  // Statistical facet
  KAnonymityAnalysis: Id.label("base:KAnonymityAnalysis"),

  // Control facet (extended by privacy frameworks)
  ControlledData: Id.label("base:ControlledData"),
} as const;

export const labels: Label[] = [
  // ========== Subject Facet ==========
  {
    id: LABEL_IDS.Individual,
    name: "Individual",
    facetId: FACET_IDS.Subject,
    frameworkId: FRAMEWORK_ID,
    description: "Data about a natural person",
  },
  {
    id: LABEL_IDS.Organization,
    name: "Organization",
    facetId: FACET_IDS.Subject,
    frameworkId: FRAMEWORK_ID,
    description: "Data about a legal entity",
  },

  // ========== Identifier Facet - Cardinality ==========
  {
    id: LABEL_IDS.UniqueCardinality,
    name: "Unique Cardinality",
    facetId: FACET_IDS.Identifier,
    frameworkId: FRAMEWORK_ID,
    description: "Value uniquely identifies one entity",
  },
  {
    id: LABEL_IDS.ClosedGroupCardinality,
    name: "Closed Group Cardinality",
    facetId: FACET_IDS.Identifier,
    frameworkId: FRAMEWORK_ID,
    description: "Value identifies a bounded group of entities",
  },
  {
    id: LABEL_IDS.OpenGroupCardinality,
    name: "Open Group Cardinality",
    facetId: FACET_IDS.Identifier,
    frameworkId: FRAMEWORK_ID,
    description: "Value identifies an unbounded group of entities",
  },

  // ========== Identifier Facet - Knowability ==========
  {
    id: LABEL_IDS.OpenKnowability,
    name: "Open Knowability",
    facetId: FACET_IDS.Identifier,
    frameworkId: FRAMEWORK_ID,
    description: "Value is publicly known or obtainable",
  },
  {
    id: LABEL_IDS.ClosedKnowability,
    name: "Closed Knowability",
    facetId: FACET_IDS.Identifier,
    frameworkId: FRAMEWORK_ID,
    description: "Value is not publicly known",
  },

  // ========== Identifier Facet - Derived ==========
  {
    id: LABEL_IDS.DirectIdentifier,
    name: "Direct Identifier",
    facetId: FACET_IDS.Identifier,
    frameworkId: FRAMEWORK_ID,
    description: "Unique + Open = directly identifies an individual (e.g., SSN)",
  },
  {
    id: LABEL_IDS.InternalIdentifier,
    name: "Internal Identifier",
    facetId: FACET_IDS.Identifier,
    frameworkId: FRAMEWORK_ID,
    description: "Unique + Closed = internal identifier (e.g., UUID)",
  },
  {
    id: LABEL_IDS.IndirectIdentifier,
    name: "Indirect Identifier",
    facetId: FACET_IDS.Identifier,
    frameworkId: FRAMEWORK_ID,
    description: "OpenGroup + Open = quasi-identifier (e.g., ZIP code)",
  },
  {
    id: LABEL_IDS.IdentifierData,
    name: "Identifier Data",
    facetId: FACET_IDS.Identifier,
    frameworkId: FRAMEWORK_ID,
    description: "Superclass for all identifier types",
  },

  // ========== Kind Facet - Common Data Kinds ==========
  {
    id: LABEL_IDS.Name,
    name: "Name",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Personal name",
  },
  {
    id: LABEL_IDS.Address,
    name: "Address",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Geographic address",
  },
  {
    id: LABEL_IDS.Phone,
    name: "Phone",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Telephone number",
  },
  {
    id: LABEL_IDS.Email,
    name: "Email",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Email address",
  },
  {
    id: LABEL_IDS.SSN,
    name: "SSN",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Social Security Number",
  },
  {
    id: LABEL_IDS.MedicalRecordNumber,
    name: "Medical Record Number",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Medical record identifier",
  },
  {
    id: LABEL_IDS.HealthPlanNumber,
    name: "Health Plan Number",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Health plan beneficiary number",
  },
  {
    id: LABEL_IDS.AccountNumber,
    name: "Account Number",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Account number",
  },
  {
    id: LABEL_IDS.CertificateNumber,
    name: "Certificate Number",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Certificate/license number",
  },
  {
    id: LABEL_IDS.VehicleIdentifier,
    name: "Vehicle Identifier",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Vehicle identification number",
  },
  {
    id: LABEL_IDS.DeviceIdentifier,
    name: "Device Identifier",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Device identification number",
  },
  {
    id: LABEL_IDS.WebURL,
    name: "Web URL",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Web URL",
  },
  {
    id: LABEL_IDS.IPAddress,
    name: "IP Address",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Internet Protocol address",
  },
  {
    id: LABEL_IDS.BiometricData,
    name: "Biometric Data",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Biometric identifiers (fingerprints, voice prints, etc.)",
  },
  {
    id: LABEL_IDS.FaceImage,
    name: "Face Image",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Full-face photographic image",
  },
  {
    id: LABEL_IDS.UniqueID,
    name: "Unique ID",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Any other unique identifying number",
  },
  {
    id: LABEL_IDS.MomentData,
    name: "Moment Data",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Date-related data (dates, timestamps)",
  },
  {
    id: LABEL_IDS.Fax,
    name: "Fax",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Fax number",
  },

  // ========== Kind Facet - Medical Data ==========
  {
    id: LABEL_IDS.DiagnosisCode,
    name: "Diagnosis Code",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Medical diagnosis code (ICD-10, etc.)",
  },
  {
    id: LABEL_IDS.ProcedureCode,
    name: "Procedure Code",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Medical procedure code (CPT, etc.)",
  },
  {
    id: LABEL_IDS.MedicationData,
    name: "Medication Data",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Medication information",
  },
  {
    id: LABEL_IDS.LabResult,
    name: "Lab Result",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Laboratory test result",
  },
  {
    id: LABEL_IDS.VitalSign,
    name: "Vital Sign",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Vital sign measurement",
  },

  // ========== Kind Facet - Demographics ==========
  {
    id: LABEL_IDS.Age,
    name: "Age",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Age value",
  },
  {
    id: LABEL_IDS.Gender,
    name: "Gender",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Gender information",
  },
  {
    id: LABEL_IDS.Ethnicity,
    name: "Ethnicity",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Ethnicity information",
  },
  {
    id: LABEL_IDS.DateOfBirth,
    name: "Date of Birth",
    facetId: FACET_IDS.Kind,
    frameworkId: FRAMEWORK_ID,
    description: "Date of birth",
  },

  // ========== Domain Facet ==========
  {
    id: LABEL_IDS.Healthcare,
    name: "Healthcare",
    facetId: FACET_IDS.Domain,
    frameworkId: FRAMEWORK_ID,
    description: "Healthcare domain context",
  },
  {
    id: LABEL_IDS.Financial,
    name: "Financial",
    facetId: FACET_IDS.Domain,
    frameworkId: FRAMEWORK_ID,
    description: "Financial domain context",
  },
  {
    id: LABEL_IDS.Employment,
    name: "Employment",
    facetId: FACET_IDS.Domain,
    frameworkId: FRAMEWORK_ID,
    description: "Employment/HR domain context",
  },
  {
    id: LABEL_IDS.Research,
    name: "Research",
    facetId: FACET_IDS.Domain,
    frameworkId: FRAMEWORK_ID,
    description: "Research domain context",
  },

  // ========== Statistical Facet ==========
  {
    id: LABEL_IDS.KAnonymityAnalysis,
    name: "K-Anonymity Analysis",
    facetId: FACET_IDS.Statistical,
    frameworkId: FRAMEWORK_ID,
    description: "K-anonymity statistical analysis result",
    parameterSchema: {
      minimumCohortSize: ParameterType.Number,
    },
  },

  // ========== Control Facet ==========
  {
    id: LABEL_IDS.ControlledData,
    name: "Controlled Data",
    facetId: FACET_IDS.Control,
    frameworkId: FRAMEWORK_ID,
    description: "Data subject to regulatory controls",
  },
];

// ============================================================================
// RULES
// ============================================================================

/**
 * Equivalence rules for identifier derivation.
 * From Table 2 in the paper:
 * - DirectIdentifier ≡ Unique ∧ Open
 * - InternalIdentifier ≡ Unique ∧ Closed
 * - IndirectIdentifier ≡ OpenGroup ∧ Open
 */
export const equivalenceRules: EquivalenceRule[] = [
  {
    id: Id.rule("base:DirectIdentifier-equiv"),
    frameworkId: FRAMEWORK_ID,
    fromAllLabelIds: [LABEL_IDS.UniqueCardinality, LABEL_IDS.OpenKnowability],
    toLabelId: LABEL_IDS.DirectIdentifier,
  },
  {
    id: Id.rule("base:InternalIdentifier-equiv"),
    frameworkId: FRAMEWORK_ID,
    fromAllLabelIds: [LABEL_IDS.UniqueCardinality, LABEL_IDS.ClosedKnowability],
    toLabelId: LABEL_IDS.InternalIdentifier,
  },
  {
    id: Id.rule("base:IndirectIdentifier-equiv"),
    frameworkId: FRAMEWORK_ID,
    fromAllLabelIds: [LABEL_IDS.OpenGroupCardinality, LABEL_IDS.OpenKnowability],
    toLabelId: LABEL_IDS.IndirectIdentifier,
  },
];

/**
 * Subclass rules for identifier hierarchy.
 * All identifier types are subclasses of IdentifierData.
 */
export const subclassRules: SubclassRule[] = [
  {
    id: Id.rule("base:DirectIdentifier-subclass"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [LABEL_IDS.DirectIdentifier],
    toLabelId: LABEL_IDS.IdentifierData,
  },
  {
    id: Id.rule("base:InternalIdentifier-subclass"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [LABEL_IDS.InternalIdentifier],
    toLabelId: LABEL_IDS.IdentifierData,
  },
  {
    id: Id.rule("base:IndirectIdentifier-subclass"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [LABEL_IDS.IndirectIdentifier],
    toLabelId: LABEL_IDS.IdentifierData,
  },
  // Common direct identifiers
  {
    id: Id.rule("base:SSN-DirectIdentifier"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [LABEL_IDS.SSN],
    toLabelId: LABEL_IDS.DirectIdentifier,
  },
  {
    id: Id.rule("base:Email-DirectIdentifier"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [LABEL_IDS.Email],
    toLabelId: LABEL_IDS.DirectIdentifier,
  },
  {
    id: Id.rule("base:MRN-DirectIdentifier"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [LABEL_IDS.MedicalRecordNumber],
    toLabelId: LABEL_IDS.DirectIdentifier,
  },
  // Demographics as indirect identifiers (quasi-identifiers)
  {
    id: Id.rule("base:Age-IndirectIdentifier"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [LABEL_IDS.Age],
    toLabelId: LABEL_IDS.IndirectIdentifier,
  },
  {
    id: Id.rule("base:Gender-IndirectIdentifier"),
    frameworkId: FRAMEWORK_ID,
    fromLabelIds: [LABEL_IDS.Gender],
    toLabelId: LABEL_IDS.IndirectIdentifier,
  },
];

/**
 * Propagation rules.
 * From the paper: "Type, Kind, and Domain propagate inward to child containers."
 */
export const propagationRules: PropagationRule[] = [
  // Subject (Type) propagates inward
  {
    id: Id.rule("base:Individual-propagate-inward"),
    frameworkId: FRAMEWORK_ID,
    labelId: LABEL_IDS.Individual,
    direction: PropagationDirection.Inward,
  },
  {
    id: Id.rule("base:Organization-propagate-inward"),
    frameworkId: FRAMEWORK_ID,
    labelId: LABEL_IDS.Organization,
    direction: PropagationDirection.Inward,
  },
  // Domain propagates inward
  {
    id: Id.rule("base:Healthcare-propagate-inward"),
    frameworkId: FRAMEWORK_ID,
    labelId: LABEL_IDS.Healthcare,
    direction: PropagationDirection.Inward,
  },
  {
    id: Id.rule("base:Financial-propagate-inward"),
    frameworkId: FRAMEWORK_ID,
    labelId: LABEL_IDS.Financial,
    direction: PropagationDirection.Inward,
  },
  {
    id: Id.rule("base:Employment-propagate-inward"),
    frameworkId: FRAMEWORK_ID,
    labelId: LABEL_IDS.Employment,
    direction: PropagationDirection.Inward,
  },
  {
    id: Id.rule("base:Research-propagate-inward"),
    frameworkId: FRAMEWORK_ID,
    labelId: LABEL_IDS.Research,
    direction: PropagationDirection.Inward,
  },
];

// No implication rules in base framework
export const implicationRules: never[] = [];
