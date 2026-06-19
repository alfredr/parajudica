/**
 * Compliance Store
 *
 * Manages framework selection and compliance analysis state.
 * Integrates with the Parajudica inference engine.
 */

import { writable, derived, get } from "svelte/store";
import {
  infer,
  queryAssertions,
  BaseFramework,
  HIPAAFramework,
  GDPRFramework,
  ItalianDPAFramework,
  type InferenceResult,
  type ComplianceEnvironment,
  type Framework,
  type Label,
  type Facet,
  type ComplianceAssertion,
} from "@parajudica/engine";
import {
  type FrameworkId,
  type LabelId,
  type ContainerId,
  type ScopeId,
  Id,
} from "@parajudica/schema";
import {
  containers,
  scopes,
  joinableRelations,
  scopeContainerMappings,
} from "./environment.ts";

// ============================================================================
// FRAMEWORK REGISTRY
// ============================================================================

export interface FrameworkInfo {
  id: FrameworkId;
  name: string;
  description?: string;
  color: string;
  parentId: FrameworkId | null;
  isSubFramework: boolean;
}

// Register all available frameworks with UI metadata
export const frameworkRegistry: FrameworkInfo[] = [
  {
    id: BaseFramework.FRAMEWORK_ID,
    name: "Base Framework",
    description: "Foundational taxonomies",
    color: "#718096",
    parentId: null,
    isSubFramework: false,
  },
  {
    id: HIPAAFramework.FRAMEWORK_ID,
    name: "HIPAA",
    description: "Protected Health Information",
    color: "#3182ce",
    parentId: null,
    isSubFramework: false,
  },
  {
    id: HIPAAFramework.SAFE_HARBOR_ID,
    name: "Safe Harbor",
    description: "18 identifier removal",
    color: "#63b3ed",
    parentId: HIPAAFramework.FRAMEWORK_ID,
    isSubFramework: true,
  },
  {
    id: HIPAAFramework.EXPERT_DETERMINATION_ID,
    name: "Expert Determination",
    description: "Statistical de-identification",
    color: "#90cdf4",
    parentId: HIPAAFramework.FRAMEWORK_ID,
    isSubFramework: true,
  },
  {
    id: GDPRFramework.FRAMEWORK_ID,
    name: "GDPR",
    description: "Personal Data protection",
    color: "#38a169",
    parentId: null,
    isSubFramework: false,
  },
  {
    id: GDPRFramework.EMA_FRAMEWORK_ID,
    name: "EMA",
    description: "Clinical trial anonymization",
    color: "#68d391",
    parentId: GDPRFramework.FRAMEWORK_ID,
    isSubFramework: true,
  },
  {
    id: ItalianDPAFramework.FRAMEWORK_ID,
    name: "Italian DPA",
    description: "Stricter GDPR interpretation",
    color: "#ed8936",
    parentId: null,
    isSubFramework: false,
  },
];

// ============================================================================
// STORES
// ============================================================================

/** Selected framework IDs */
export const selectedFrameworkIds = writable<Set<FrameworkId>>(
  new Set([BaseFramework.FRAMEWORK_ID, HIPAAFramework.FRAMEWORK_ID])
);

/** Analysis result from engine */
export const analysisResult = writable<InferenceResult | null>(null);

/** Is analysis currently running */
export const isAnalyzing = writable(false);

/** Show comparison mode (highlight differences) */
export const comparisonMode = writable(false);

// ============================================================================
// DERIVED STORES
// ============================================================================

/** Get labels for a specific container across all selected frameworks */
export const labelsPerContainer = derived(
  [analysisResult, selectedFrameworkIds],
  ([$result, $selected]) => {
    const map = new Map<string, Map<FrameworkId, LabelInfo[]>>();

    if (!$result) return map;

    for (const assertion of $result.assertions) {
      if (!$selected.has(assertion.frameworkId)) continue;

      // Create composite key: containerId-scopeId
      const key = `${assertion.containerId}`;

      if (!map.has(key)) {
        map.set(key, new Map());
      }

      const containerMap = map.get(key)!;
      if (!containerMap.has(assertion.frameworkId)) {
        containerMap.set(assertion.frameworkId, []);
      }

      const labelInfo = getLabelInfo(assertion.labelId, assertion.frameworkId);
      if (labelInfo) {
        containerMap.get(assertion.frameworkId)!.push(labelInfo);
      }
    }

    return map;
  }
);

/** Get labels that differ between frameworks for comparison */
export const differingLabels = derived(
  [labelsPerContainer, selectedFrameworkIds],
  ([$labels, $selected]) => {
    const differing = new Map<string, Set<string>>();

    for (const [containerId, frameworkLabels] of $labels) {
      const allLabelIds = new Set<string>();
      const labelCounts = new Map<string, number>();

      for (const [_fwId, labels] of frameworkLabels) {
        for (const label of labels) {
          allLabelIds.add(label.id);
          labelCounts.set(label.id, (labelCounts.get(label.id) ?? 0) + 1);
        }
      }

      // Find labels that don't appear in all frameworks
      const frameworkCount = $selected.size;
      const diff = new Set<string>();
      for (const [labelId, count] of labelCounts) {
        if (count < frameworkCount) {
          diff.add(labelId);
        }
      }

      if (diff.size > 0) {
        differing.set(containerId, diff);
      }
    }

    return differing;
  }
);

// ============================================================================
// LABEL REGISTRY
// ============================================================================

export interface LabelInfo {
  id: string;
  name: string;
  facetName: string;
  frameworkId: FrameworkId;
  frameworkColor: string;
}

// Build label lookup from all frameworks
const allLabels: Label[] = [
  ...BaseFramework.labels,
  ...HIPAAFramework.labels,
  ...GDPRFramework.labels,
  ...ItalianDPAFramework.labels,
];

const allFacets: Facet[] = [
  ...BaseFramework.facets,
  ...HIPAAFramework.facets,
  ...GDPRFramework.facets,
  ...ItalianDPAFramework.facets,
];

const labelMap = new Map<string, Label>();
for (const label of allLabels) {
  labelMap.set(label.id, label);
}

const facetMap = new Map<string, Facet>();
for (const facet of allFacets) {
  facetMap.set(facet.id, facet);
}

function getLabelInfo(labelId: LabelId, frameworkId: FrameworkId): LabelInfo | null {
  const label = labelMap.get(labelId);
  if (!label) return null;

  const facet = facetMap.get(label.facetId);
  const framework = frameworkRegistry.find((f) => f.id === frameworkId);

  return {
    id: labelId,
    name: label.name,
    facetName: facet?.name ?? "Unknown",
    frameworkId,
    frameworkColor: framework?.color ?? "#718096",
  };
}

// ============================================================================
// ACTIONS
// ============================================================================

export function toggleFramework(frameworkId: FrameworkId) {
  selectedFrameworkIds.update((ids) => {
    const newIds = new Set(ids);
    if (newIds.has(frameworkId)) {
      newIds.delete(frameworkId);
    } else {
      newIds.add(frameworkId);
    }
    return newIds;
  });
}

export function selectAllFrameworks() {
  selectedFrameworkIds.set(new Set(frameworkRegistry.map((f) => f.id)));
}

export function clearFrameworks() {
  selectedFrameworkIds.set(new Set());
}

export async function runAnalysis() {
  isAnalyzing.set(true);

  try {
    // Get current frontend state
    const currentContainers = get(containers) as FrontendContainer[];
    const currentScopes = get(scopes) as FrontendScope[];
    const currentJoinable = get(joinableRelations) as FrontendJoinable[];
    const currentMappings = get(scopeContainerMappings) as FrontendMapping[];
    const selectedFws = get(selectedFrameworkIds);

    // Build the compliance environment
    const env = buildComplianceEnvironment(
      currentContainers,
      currentScopes,
      currentJoinable,
      currentMappings,
      selectedFws
    );

    // Run inference (async to not block UI)
    await new Promise((resolve) => setTimeout(resolve, 10)); // Let UI update
    const result = infer(env, {
      enableMetrics: true,
    });

    analysisResult.set(result);
  } catch (error) {
    console.error("Analysis failed:", error);
    analysisResult.set(null);
  } finally {
    isAnalyzing.set(false);
  }
}

export function clearResults() {
  analysisResult.set(null);
}

// ============================================================================
// ENGINE BRIDGE
// ============================================================================

interface FrontendContainer {
  id: string;
  name: string;
  parentId: string | null;
  type: "database" | "table" | "column";
}

interface FrontendScope {
  id: string;
  name: string;
  description?: string;
  color: string;
}

interface FrontendJoinable {
  container1Id: string;
  container2Id: string;
}

interface FrontendMapping {
  scopeId: string;
  containerId: string;
  position: { x: number; y: number };
}

function buildComplianceEnvironment(
  frontendContainers: FrontendContainer[],
  frontendScopes: FrontendScope[],
  frontendJoinable: FrontendJoinable[],
  frontendMappings: FrontendMapping[],
  selectedFrameworks: Set<FrameworkId>
): ComplianceEnvironment {
  // Convert containers
  const engineContainers = frontendContainers.map((c) => ({
    id: Id.container(c.id),
    name: c.name,
    parentId: c.parentId ? Id.container(c.parentId) : null,
    metadata: { type: c.type },
  }));

  // Convert scopes with visible containers
  const engineScopes = frontendScopes.map((s) => {
    const visibleIds = frontendMappings
      .filter((m) => m.scopeId === s.id)
      .map((m) => Id.container(m.containerId));

    // Also include children of visible containers
    const allVisibleIds = new Set(visibleIds);
    for (const container of frontendContainers) {
      if (container.parentId && allVisibleIds.has(Id.container(container.parentId))) {
        allVisibleIds.add(Id.container(container.id));
      }
    }

    return {
      id: Id.scope(s.id),
      name: s.name,
      description: s.description,
      visibleContainerIds: Array.from(allVisibleIds),
    };
  });

  // Convert joinable relations
  const engineJoinable = frontendJoinable.map((j) => ({
    container1Id: Id.container(j.container1Id),
    container2Id: Id.container(j.container2Id),
  }));

  // Collect frameworks, facets, labels, and rules based on selection
  const frameworks: Framework[] = [];
  const facets: Facet[] = [];
  const labels: Label[] = [];
  const subclassRules: any[] = [];
  const equivalenceRules: any[] = [];
  const implicationRules: any[] = [];
  const propagationRules: any[] = [];

  // Always include base framework
  frameworks.push(BaseFramework.framework);
  facets.push(...BaseFramework.facets);
  labels.push(...BaseFramework.labels);
  subclassRules.push(...BaseFramework.subclassRules);
  equivalenceRules.push(...BaseFramework.equivalenceRules);
  propagationRules.push(...BaseFramework.propagationRules);

  // Add selected frameworks
  if (selectedFrameworks.has(HIPAAFramework.FRAMEWORK_ID) ||
      selectedFrameworks.has(HIPAAFramework.SAFE_HARBOR_ID) ||
      selectedFrameworks.has(HIPAAFramework.EXPERT_DETERMINATION_ID)) {
    frameworks.push(HIPAAFramework.framework);
    if (selectedFrameworks.has(HIPAAFramework.SAFE_HARBOR_ID)) {
      frameworks.push(HIPAAFramework.safeHarborFramework);
    }
    if (selectedFrameworks.has(HIPAAFramework.EXPERT_DETERMINATION_ID)) {
      frameworks.push(HIPAAFramework.expertDeterminationFramework);
    }
    facets.push(...HIPAAFramework.facets);
    labels.push(...HIPAAFramework.labels);
    subclassRules.push(...HIPAAFramework.subclassRules);
    equivalenceRules.push(...HIPAAFramework.equivalenceRules);
    implicationRules.push(...HIPAAFramework.implicationRules);
    propagationRules.push(...HIPAAFramework.propagationRules);
  }

  if (selectedFrameworks.has(GDPRFramework.FRAMEWORK_ID) ||
      selectedFrameworks.has(GDPRFramework.EMA_FRAMEWORK_ID)) {
    frameworks.push(GDPRFramework.framework);
    if (selectedFrameworks.has(GDPRFramework.EMA_FRAMEWORK_ID)) {
      frameworks.push(GDPRFramework.emaFramework);
    }
    facets.push(...GDPRFramework.facets);
    labels.push(...GDPRFramework.labels);
    subclassRules.push(...GDPRFramework.subclassRules);
    equivalenceRules.push(...GDPRFramework.equivalenceRules);
    implicationRules.push(...GDPRFramework.implicationRules);
    propagationRules.push(...GDPRFramework.propagationRules);
  }

  if (selectedFrameworks.has(ItalianDPAFramework.FRAMEWORK_ID)) {
    frameworks.push(ItalianDPAFramework.framework);
    facets.push(...ItalianDPAFramework.facets);
    labels.push(...ItalianDPAFramework.labels);
    implicationRules.push(...ItalianDPAFramework.implicationRules);
  }

  // Create ground assertions for demo
  // In the real app, these would come from user annotations
  const groundAssertions = createGroundAssertions(
    engineContainers,
    engineScopes,
    frameworks
  );

  return {
    containers: engineContainers,
    scopes: engineScopes,
    joinableRelations: engineJoinable,
    frameworks,
    facets,
    labels,
    subclassRules,
    equivalenceRules,
    implicationRules,
    propagationRules,
    groundAssertions,
  };
}

function createGroundAssertions(
  containers: any[],
  scopes: any[],
  frameworks: Framework[]
): ComplianceAssertion[] {
  const assertions: ComplianceAssertion[] = [];
  let counter = 0;

  // Find the base framework
  const baseFramework = frameworks.find((f) => f.id === BaseFramework.FRAMEWORK_ID);
  if (!baseFramework) return assertions;

  // Assign ground labels based on container metadata
  for (const container of containers) {
    for (const scope of scopes) {
      // Check if container is visible in scope
      if (!scope.visibleContainerIds.includes(container.id)) continue;

      const type = container.metadata?.type;

      // Tables with patient/provider info are about individuals
      if (container.name.toLowerCase().includes("patient") ||
          container.name.toLowerCase().includes("provider") ||
          container.name.toLowerCase().includes("info")) {
        assertions.push({
          id: Id.assertion(`ground-${counter++}`),
          containerId: container.id,
          labelId: BaseFramework.LABEL_IDS.Individual,
          scopeId: scope.id,
          frameworkId: BaseFramework.FRAMEWORK_ID,
          isGround: true,
        });
      }

      // Columns that are identifiers
      if (type === "column") {
        const name = container.name.toLowerCase();
        if (name === "ssn" || name === "mrn") {
          // Direct identifiers - unique cardinality and open knowability
          assertions.push({
            id: Id.assertion(`ground-${counter++}`),
            containerId: container.id,
            labelId: BaseFramework.LABEL_IDS.UniqueCardinality,
            scopeId: scope.id,
            frameworkId: BaseFramework.FRAMEWORK_ID,
            isGround: true,
          });
          assertions.push({
            id: Id.assertion(`ground-${counter++}`),
            containerId: container.id,
            labelId: BaseFramework.LABEL_IDS.OpenKnowability,
            scopeId: scope.id,
            frameworkId: BaseFramework.FRAMEWORK_ID,
            isGround: true,
          });
        } else if (name === "name") {
          // Quasi-identifier - closed group cardinality
          assertions.push({
            id: Id.assertion(`ground-${counter++}`),
            containerId: container.id,
            labelId: BaseFramework.LABEL_IDS.ClosedGroupCardinality,
            scopeId: scope.id,
            frameworkId: BaseFramework.FRAMEWORK_ID,
            isGround: true,
          });
          assertions.push({
            id: Id.assertion(`ground-${counter++}`),
            containerId: container.id,
            labelId: BaseFramework.LABEL_IDS.OpenKnowability,
            scopeId: scope.id,
            frameworkId: BaseFramework.FRAMEWORK_ID,
            isGround: true,
          });
        } else if (name === "date" || name.includes("date")) {
          // Moment data
          assertions.push({
            id: Id.assertion(`ground-${counter++}`),
            containerId: container.id,
            labelId: BaseFramework.LABEL_IDS.MomentData,
            scopeId: scope.id,
            frameworkId: BaseFramework.FRAMEWORK_ID,
            isGround: true,
          });
        } else if (name === "diagnosis" || name === "procedure") {
          // Healthcare domain data
          assertions.push({
            id: Id.assertion(`ground-${counter++}`),
            containerId: container.id,
            labelId: BaseFramework.LABEL_IDS.Healthcare,
            scopeId: scope.id,
            frameworkId: BaseFramework.FRAMEWORK_ID,
            isGround: true,
          });
        }
      }

      // Tables in healthcare context
      if (type === "table" && (
        container.name.toLowerCase().includes("patient") ||
        container.name.toLowerCase().includes("treatment") ||
        container.name.toLowerCase().includes("encounter")
      )) {
        assertions.push({
          id: Id.assertion(`ground-${counter++}`),
          containerId: container.id,
          labelId: BaseFramework.LABEL_IDS.Healthcare,
          scopeId: scope.id,
          frameworkId: BaseFramework.FRAMEWORK_ID,
          isGround: true,
        });
      }
    }
  }

  return assertions;
}
