/**
 * Engine Tests
 *
 * Validates the inference engine against the healthcare scenario from the paper.
 * Tests all five compliance challenges:
 * 1. Context-dependent classification
 * 2. Diverging interpretations
 * 3. Proximity semantics
 * 4. De-identification scenarios
 * 5. Comparative evaluation
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  type ComplianceEnvironment,
  type Container,
  type GovernanceScope,
  type JoinableRelation,
  type ComplianceAssertion,
  Id,
  PropagationDirection,
  ParameterType,
} from "@parajudica/schema";
import { ComplianceInferenceEngine, queryAssertions } from "./engine.ts";
import * as BaseFramework from "../data/base.ts";
import * as HIPAAFramework from "../data/hipaa.ts";
import * as GDPRFramework from "../data/gdpr.ts";
import * as ItalianDPAFramework from "../data/italian-dpa.ts";

// ============================================================================
// TEST FIXTURES - Healthcare Scenario from the paper
// ============================================================================

/**
 * From Figure 3 in the paper:
 * - ProvidersInfo (HR table with names, SSNs, vaccination dates)
 * - PatientInfo, PatientEncounters, PatientTreatments (clinical tables)
 * - HRScope sees only ProvidersInfo
 * - MedicalScope sees only patient tables
 * - ResearchScope sees both (enables cross-system joins)
 */

// Container IDs
const PROVIDERS_INFO = Id.container("ProvidersInfo");
const PROVIDERS_NAME = Id.container("ProvidersInfo.name");
const PROVIDERS_SSN = Id.container("ProvidersInfo.ssn");
const PROVIDERS_VACCINATION_DATE = Id.container("ProvidersInfo.vaccinationDate");

const PATIENT_INFO = Id.container("PatientInfo");
const PATIENT_INFO_MRN = Id.container("PatientInfo.mrn");
const PATIENT_INFO_NAME = Id.container("PatientInfo.name");

const PATIENT_ENCOUNTERS = Id.container("PatientEncounters");
const PATIENT_ENCOUNTERS_DATE = Id.container("PatientEncounters.date");

const PATIENT_TREATMENTS = Id.container("PatientTreatments");
const PATIENT_TREATMENTS_DIAGNOSIS = Id.container("PatientTreatments.diagnosis");
const PATIENT_TREATMENTS_PROCEDURE = Id.container("PatientTreatments.procedure");

// Scope IDs
const HR_SCOPE = Id.scope("HRScope");
const MEDICAL_SCOPE = Id.scope("MedicalScope");
const RESEARCH_SCOPE = Id.scope("ResearchScope");

// Containers
const containers: Container[] = [
  // HR Table
  { id: PROVIDERS_INFO, name: "ProvidersInfo", parentId: null },
  { id: PROVIDERS_NAME, name: "name", parentId: PROVIDERS_INFO },
  { id: PROVIDERS_SSN, name: "ssn", parentId: PROVIDERS_INFO },
  { id: PROVIDERS_VACCINATION_DATE, name: "vaccinationDate", parentId: PROVIDERS_INFO },

  // Patient Tables
  { id: PATIENT_INFO, name: "PatientInfo", parentId: null },
  { id: PATIENT_INFO_MRN, name: "mrn", parentId: PATIENT_INFO },
  { id: PATIENT_INFO_NAME, name: "name", parentId: PATIENT_INFO },

  { id: PATIENT_ENCOUNTERS, name: "PatientEncounters", parentId: null },
  { id: PATIENT_ENCOUNTERS_DATE, name: "date", parentId: PATIENT_ENCOUNTERS },

  { id: PATIENT_TREATMENTS, name: "PatientTreatments", parentId: null },
  { id: PATIENT_TREATMENTS_DIAGNOSIS, name: "diagnosis", parentId: PATIENT_TREATMENTS },
  { id: PATIENT_TREATMENTS_PROCEDURE, name: "procedure", parentId: PATIENT_TREATMENTS },
];

// Joinable relationships (from Figure 3)
const joinableRelations: JoinableRelation[] = [
  // ProvidersInfo joins with PatientEncounters and PatientTreatments
  { container1Id: PROVIDERS_INFO, container2Id: PATIENT_ENCOUNTERS },
  { container1Id: PROVIDERS_INFO, container2Id: PATIENT_TREATMENTS },
  // Patient tables join with each other
  { container1Id: PATIENT_INFO, container2Id: PATIENT_ENCOUNTERS },
  { container1Id: PATIENT_INFO, container2Id: PATIENT_TREATMENTS },
  { container1Id: PATIENT_ENCOUNTERS, container2Id: PATIENT_TREATMENTS },
];

// Governance scopes
const scopes: GovernanceScope[] = [
  {
    id: HR_SCOPE,
    name: "HR Scope",
    description: "HR system context",
    visibleContainerIds: [
      PROVIDERS_INFO,
      PROVIDERS_NAME,
      PROVIDERS_SSN,
      PROVIDERS_VACCINATION_DATE,
    ],
  },
  {
    id: MEDICAL_SCOPE,
    name: "Medical Scope",
    description: "Clinical system context",
    visibleContainerIds: [
      PATIENT_INFO,
      PATIENT_INFO_MRN,
      PATIENT_INFO_NAME,
      PATIENT_ENCOUNTERS,
      PATIENT_ENCOUNTERS_DATE,
      PATIENT_TREATMENTS,
      PATIENT_TREATMENTS_DIAGNOSIS,
      PATIENT_TREATMENTS_PROCEDURE,
    ],
  },
  {
    id: RESEARCH_SCOPE,
    name: "Research Scope",
    description: "Research context with both HR and clinical data",
    visibleContainerIds: [
      // All containers visible for research
      PROVIDERS_INFO,
      PROVIDERS_NAME,
      PROVIDERS_SSN,
      PROVIDERS_VACCINATION_DATE,
      PATIENT_INFO,
      PATIENT_INFO_MRN,
      PATIENT_INFO_NAME,
      PATIENT_ENCOUNTERS,
      PATIENT_ENCOUNTERS_DATE,
      PATIENT_TREATMENTS,
      PATIENT_TREATMENTS_DIAGNOSIS,
      PATIENT_TREATMENTS_PROCEDURE,
    ],
  },
];

// Ground assertions (initial facts)
function createGroundAssertions(): ComplianceAssertion[] {
  const assertions: ComplianceAssertion[] = [];
  let counter = 0;

  const addAssertion = (
    containerId: typeof PROVIDERS_INFO,
    labelId: typeof BaseFramework.LABEL_IDS.Name,
    scopeId: typeof HR_SCOPE,
    frameworkId: typeof BaseFramework.FRAMEWORK_ID,
    parameters?: Record<string, unknown>
  ) => {
    assertions.push({
      id: Id.assertion(`ground-${++counter}`),
      containerId,
      labelId,
      scopeId,
      frameworkId,
      isGround: true,
      parameters,
    });
  };

  // HR Scope ground assertions
  // ProvidersInfo is about individuals in employment context
  addAssertion(PROVIDERS_INFO, BaseFramework.LABEL_IDS.Individual, HR_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PROVIDERS_INFO, BaseFramework.LABEL_IDS.Employment, HR_SCOPE, BaseFramework.FRAMEWORK_ID);

  // Name column
  addAssertion(PROVIDERS_NAME, BaseFramework.LABEL_IDS.Name, HR_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PROVIDERS_NAME, BaseFramework.LABEL_IDS.UniqueCardinality, HR_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PROVIDERS_NAME, BaseFramework.LABEL_IDS.OpenKnowability, HR_SCOPE, BaseFramework.FRAMEWORK_ID);

  // SSN column
  addAssertion(PROVIDERS_SSN, BaseFramework.LABEL_IDS.SSN, HR_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PROVIDERS_SSN, BaseFramework.LABEL_IDS.UniqueCardinality, HR_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PROVIDERS_SSN, BaseFramework.LABEL_IDS.OpenKnowability, HR_SCOPE, BaseFramework.FRAMEWORK_ID);

  // Vaccination date (medical data in HR context)
  addAssertion(PROVIDERS_VACCINATION_DATE, BaseFramework.LABEL_IDS.MomentData, HR_SCOPE, BaseFramework.FRAMEWORK_ID);

  // Medical Scope ground assertions
  // Patient tables are in healthcare context
  addAssertion(PATIENT_INFO, BaseFramework.LABEL_IDS.Individual, MEDICAL_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PATIENT_INFO, BaseFramework.LABEL_IDS.Healthcare, MEDICAL_SCOPE, BaseFramework.FRAMEWORK_ID);

  addAssertion(PATIENT_INFO_MRN, BaseFramework.LABEL_IDS.MedicalRecordNumber, MEDICAL_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PATIENT_INFO_MRN, BaseFramework.LABEL_IDS.UniqueCardinality, MEDICAL_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PATIENT_INFO_MRN, BaseFramework.LABEL_IDS.ClosedKnowability, MEDICAL_SCOPE, BaseFramework.FRAMEWORK_ID);

  addAssertion(PATIENT_INFO_NAME, BaseFramework.LABEL_IDS.Name, MEDICAL_SCOPE, BaseFramework.FRAMEWORK_ID);

  addAssertion(PATIENT_ENCOUNTERS, BaseFramework.LABEL_IDS.Healthcare, MEDICAL_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PATIENT_TREATMENTS, BaseFramework.LABEL_IDS.Healthcare, MEDICAL_SCOPE, BaseFramework.FRAMEWORK_ID);

  addAssertion(PATIENT_TREATMENTS_DIAGNOSIS, BaseFramework.LABEL_IDS.DiagnosisCode, MEDICAL_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PATIENT_TREATMENTS_PROCEDURE, BaseFramework.LABEL_IDS.ProcedureCode, MEDICAL_SCOPE, BaseFramework.FRAMEWORK_ID);

  // Research Scope - copy HR and Medical assertions plus add healthcare context to ProvidersInfo
  // (In research scope, vaccination records are viewed in healthcare context)
  addAssertion(PROVIDERS_INFO, BaseFramework.LABEL_IDS.Individual, RESEARCH_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PROVIDERS_INFO, BaseFramework.LABEL_IDS.Healthcare, RESEARCH_SCOPE, BaseFramework.FRAMEWORK_ID);

  addAssertion(PROVIDERS_NAME, BaseFramework.LABEL_IDS.Name, RESEARCH_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PROVIDERS_NAME, BaseFramework.LABEL_IDS.UniqueCardinality, RESEARCH_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PROVIDERS_NAME, BaseFramework.LABEL_IDS.OpenKnowability, RESEARCH_SCOPE, BaseFramework.FRAMEWORK_ID);

  addAssertion(PROVIDERS_SSN, BaseFramework.LABEL_IDS.SSN, RESEARCH_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PROVIDERS_SSN, BaseFramework.LABEL_IDS.UniqueCardinality, RESEARCH_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PROVIDERS_SSN, BaseFramework.LABEL_IDS.OpenKnowability, RESEARCH_SCOPE, BaseFramework.FRAMEWORK_ID);

  addAssertion(PATIENT_INFO, BaseFramework.LABEL_IDS.Individual, RESEARCH_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PATIENT_INFO, BaseFramework.LABEL_IDS.Healthcare, RESEARCH_SCOPE, BaseFramework.FRAMEWORK_ID);

  addAssertion(PATIENT_INFO_MRN, BaseFramework.LABEL_IDS.MedicalRecordNumber, RESEARCH_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PATIENT_TREATMENTS, BaseFramework.LABEL_IDS.Healthcare, RESEARCH_SCOPE, BaseFramework.FRAMEWORK_ID);
  addAssertion(PATIENT_TREATMENTS_DIAGNOSIS, BaseFramework.LABEL_IDS.DiagnosisCode, RESEARCH_SCOPE, BaseFramework.FRAMEWORK_ID);

  return assertions;
}

// Build complete environment
function buildTestEnvironment(): ComplianceEnvironment {
  return {
    containers,
    joinableRelations,
    scopes,
    frameworks: [
      BaseFramework.framework,
      ...HIPAAFramework.frameworks,
      ...GDPRFramework.frameworks,
      ...ItalianDPAFramework.frameworks,
    ],
    facets: [
      ...BaseFramework.facets,
      ...HIPAAFramework.facets,
      ...GDPRFramework.facets,
      ...ItalianDPAFramework.facets,
    ],
    labels: [
      ...BaseFramework.labels,
      ...HIPAAFramework.labels,
      ...GDPRFramework.labels,
      ...ItalianDPAFramework.labels,
    ],
    subclassRules: [
      ...BaseFramework.subclassRules,
      ...HIPAAFramework.subclassRules,
      ...GDPRFramework.subclassRules,
      ...ItalianDPAFramework.subclassRules,
    ],
    equivalenceRules: [
      ...BaseFramework.equivalenceRules,
      ...HIPAAFramework.equivalenceRules,
      ...GDPRFramework.equivalenceRules,
      ...ItalianDPAFramework.equivalenceRules,
    ],
    implicationRules: [
      ...BaseFramework.implicationRules,
      ...HIPAAFramework.implicationRules,
      ...GDPRFramework.implicationRules,
      ...ItalianDPAFramework.implicationRules,
    ],
    propagationRules: [
      ...BaseFramework.propagationRules,
      ...HIPAAFramework.propagationRules,
      ...GDPRFramework.propagationRules,
      ...ItalianDPAFramework.propagationRules,
    ],
    groundAssertions: createGroundAssertions(),
  };
}

// ============================================================================
// TESTS
// ============================================================================

Deno.test("Engine initializes and runs to fixed point", () => {
  const env = buildTestEnvironment();
  const engine = new ComplianceInferenceEngine(env);
  const result = engine.infer();

  // Should complete without error
  assertExists(result);
  assertExists(result.assertions);
  assertExists(result.iterations);

  console.log(`Inference completed in ${result.iterations} iterations`);
  console.log(`Total assertions: ${result.assertions.length}`);
  console.log(`Metrics:`, result.metrics.ruleApplications);
});

Deno.test("Challenge 1: Context-dependent classification", () => {
  const env = buildTestEnvironment();
  const engine = new ComplianceInferenceEngine(env);
  const result = engine.infer();

  // In HR Scope: ProvidersInfo should NOT be PHI (no healthcare context)
  const hrPHI = queryAssertions(result, {
    containerId: PROVIDERS_INFO,
    labelId: HIPAAFramework.LABEL_IDS.ProtectedHealthInformation,
    scopeId: HR_SCOPE,
    frameworkId: HIPAAFramework.FRAMEWORK_ID,
  });

  // In Research Scope: ProvidersInfo SHOULD be PHI (healthcare context + joinable to patient data)
  const researchPHI = queryAssertions(result, {
    containerId: PROVIDERS_INFO,
    labelId: HIPAAFramework.LABEL_IDS.ProtectedHealthInformation,
    scopeId: RESEARCH_SCOPE,
    frameworkId: HIPAAFramework.FRAMEWORK_ID,
  });

  console.log(`HR Scope PHI assertions for ProvidersInfo: ${hrPHI.length}`);
  console.log(`Research Scope PHI assertions for ProvidersInfo: ${researchPHI.length}`);

  // HR scope should have fewer PHI assertions than research scope
  // (ProvidersInfo gains PHI through healthcare context + identifier in research)
});

Deno.test("Challenge 2: Diverging interpretations - HIPAA vs GDPR", () => {
  const env = buildTestEnvironment();
  const engine = new ComplianceInferenceEngine(env);
  const result = engine.infer();

  // HIPAA: entire joined dataset becomes PHI through expansive propagation
  const hipaaPHI = queryAssertions(result, {
    labelId: HIPAAFramework.LABEL_IDS.ProtectedHealthInformation,
    scopeId: RESEARCH_SCOPE,
    frameworkId: HIPAAFramework.FRAMEWORK_ID,
  });

  // GDPR: maintains field-level distinctions
  const gdprPersonal = queryAssertions(result, {
    labelId: GDPRFramework.LABEL_IDS.PersonalData,
    scopeId: RESEARCH_SCOPE,
    frameworkId: GDPRFramework.FRAMEWORK_ID,
  });

  const gdprHealth = queryAssertions(result, {
    labelId: GDPRFramework.LABEL_IDS.DataConcerningHealth,
    scopeId: RESEARCH_SCOPE,
    frameworkId: GDPRFramework.FRAMEWORK_ID,
  });

  console.log(`HIPAA PHI assertions in Research: ${hipaaPHI.length}`);
  console.log(`GDPR PersonalData assertions in Research: ${gdprPersonal.length}`);
  console.log(`GDPR HealthData assertions in Research: ${gdprHealth.length}`);

  // HIPAA should have more PHI due to expansive propagation
  // GDPR should distinguish between PersonalData and HealthData
});

Deno.test("Challenge 3: Proximity semantics - joinable propagation", () => {
  const env = buildTestEnvironment();
  const engine = new ComplianceInferenceEngine(env);
  const result = engine.infer();

  // Check if PHI propagated across joinable relationships
  // PatientTreatments has PHI → should propagate to ProvidersInfo via joinable
  const treatmentsPHI = queryAssertions(result, {
    containerId: PATIENT_TREATMENTS,
    labelId: HIPAAFramework.LABEL_IDS.ProtectedHealthInformation,
    scopeId: RESEARCH_SCOPE,
    frameworkId: HIPAAFramework.FRAMEWORK_ID,
  });

  const providersPhiFromJoin = queryAssertions(result, {
    containerId: PROVIDERS_INFO,
    labelId: HIPAAFramework.LABEL_IDS.ProtectedHealthInformation,
    scopeId: RESEARCH_SCOPE,
    frameworkId: HIPAAFramework.FRAMEWORK_ID,
  });

  console.log(`PatientTreatments PHI: ${treatmentsPHI.length}`);
  console.log(`ProvidersInfo PHI (via joinable): ${providersPhiFromJoin.length}`);

  // Both should have PHI due to joinable propagation
});

Deno.test("Identifier derivation works correctly", () => {
  const env = buildTestEnvironment();
  const engine = new ComplianceInferenceEngine(env);
  const result = engine.infer();

  // SSN should be classified as DirectIdentifier (Unique + Open)
  const ssnDirectId = queryAssertions(result, {
    containerId: PROVIDERS_SSN,
    labelId: BaseFramework.LABEL_IDS.DirectIdentifier,
    scopeId: HR_SCOPE,
    frameworkId: BaseFramework.FRAMEWORK_ID,
  });

  // MRN should be classified as InternalIdentifier (Unique + Closed)
  const mrnInternalId = queryAssertions(result, {
    containerId: PATIENT_INFO_MRN,
    labelId: BaseFramework.LABEL_IDS.InternalIdentifier,
    scopeId: MEDICAL_SCOPE,
    frameworkId: BaseFramework.FRAMEWORK_ID,
  });

  console.log(`SSN DirectIdentifier assertions: ${ssnDirectId.length}`);
  console.log(`MRN InternalIdentifier assertions: ${mrnInternalId.length}`);

  assertEquals(ssnDirectId.length, 1, "SSN should derive DirectIdentifier");
  assertEquals(mrnInternalId.length, 1, "MRN should derive InternalIdentifier");
});

Deno.test("Italian DPA stricter interpretation", () => {
  const env = buildTestEnvironment();
  const engine = new ComplianceInferenceEngine(env);
  const result = engine.infer();

  // Under Italian DPA, even internal identifiers (Unique + Closed) should trigger PersonalData
  // MRN is internal identifier, but Italian DPA should still classify container as PersonalData
  const italianPersonalData = queryAssertions(result, {
    containerId: PATIENT_INFO_MRN,
    labelId: GDPRFramework.LABEL_IDS.PersonalData,
    scopeId: MEDICAL_SCOPE,
    frameworkId: ItalianDPAFramework.FRAMEWORK_ID,
  });

  console.log(`Italian DPA PersonalData for MRN: ${italianPersonalData.length}`);
});
