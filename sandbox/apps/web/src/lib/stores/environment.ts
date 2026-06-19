/**
 * Environment Store
 *
 * Manages the state of the data environment being visualized/edited.
 * Tracks containers, scopes, joinable relationships, and which containers
 * appear in which scopes.
 */

import { writable, derived, get } from "svelte/store";
import type { Node, Edge } from "@xyflow/svelte";

// ============================================================================
// TYPES
// ============================================================================

export interface DataContainer {
  id: string;
  name: string;
  parentId: string | null;
  type: "database" | "table" | "column";
  metadata?: Record<string, unknown>;
}

export interface GovernanceScope {
  id: string;
  name: string;
  description?: string;
  color: string;
}

export interface JoinableRelation {
  container1Id: string;
  container2Id: string;
}

export interface ScopeContainerMapping {
  scopeId: string;
  containerId: string;
  position: { x: number; y: number };
}

export interface EnvironmentState {
  containers: DataContainer[];
  scopes: GovernanceScope[];
  joinableRelations: JoinableRelation[];
  scopeContainerMappings: ScopeContainerMapping[];
}

// ============================================================================
// STORES
// ============================================================================

/** All data containers in the environment */
export const containers = writable<DataContainer[]>([]);

/** All governance scopes */
export const scopes = writable<GovernanceScope[]>([]);

/** Joinable relationships between containers */
export const joinableRelations = writable<JoinableRelation[]>([]);

/** Which containers appear in which scopes (with positions) */
export const scopeContainerMappings = writable<ScopeContainerMapping[]>([]);

/** Currently selected node ID */
export const selectedNodeId = writable<string | null>(null);

/** Currently hovered container ID (for highlighting copies) */
export const hoveredContainerId = writable<string | null>(null);

/** Currently selected scope for editing */
export const selectedScopeId = writable<string | null>(null);

// ============================================================================
// DERIVED STORES
// ============================================================================

/** Get children of a container */
export const containerChildren = derived(containers, ($containers) => {
  const childMap = new Map<string | null, DataContainer[]>();

  for (const c of $containers) {
    const siblings = childMap.get(c.parentId) ?? [];
    siblings.push(c);
    childMap.set(c.parentId, siblings);
  }

  return childMap;
});

/** Get containers visible in a specific scope */
export function getContainersInScope(scopeId: string) {
  return derived(
    [containers, scopeContainerMappings],
    ([$containers, $mappings]) => {
      const containerIds = new Set(
        $mappings.filter((m) => m.scopeId === scopeId).map((m) => m.containerId)
      );
      return $containers.filter((c) => containerIds.has(c.id));
    }
  );
}

/** Check if a container is joinable with another */
export function isJoinable(container1Id: string, container2Id: string) {
  return derived(joinableRelations, ($relations) => {
    return $relations.some(
      (r) =>
        (r.container1Id === container1Id && r.container2Id === container2Id) ||
        (r.container1Id === container2Id && r.container2Id === container1Id)
    );
  });
}

// ============================================================================
// ACTIONS
// ============================================================================

export function addContainer(container: Omit<DataContainer, "id">) {
  const id = `container-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  containers.update((cs) => [...cs, { ...container, id }]);
  return id;
}

export function updateContainer(id: string, updates: Partial<DataContainer>) {
  containers.update((cs) =>
    cs.map((c) => (c.id === id ? { ...c, ...updates } : c))
  );
}

export function removeContainer(id: string) {
  containers.update((cs) => cs.filter((c) => c.id !== id && c.parentId !== id));
  scopeContainerMappings.update((ms) =>
    ms.filter((m) => m.containerId !== id)
  );
  joinableRelations.update((rs) =>
    rs.filter((r) => r.container1Id !== id && r.container2Id !== id)
  );
}

export function addScope(scope: Omit<GovernanceScope, "id">) {
  const id = `scope-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  scopes.update((ss) => [...ss, { ...scope, id }]);
  return id;
}

export function updateScope(id: string, updates: Partial<GovernanceScope>) {
  scopes.update((ss) =>
    ss.map((s) => (s.id === id ? { ...s, ...updates } : s))
  );
}

export function removeScope(id: string) {
  scopes.update((ss) => ss.filter((s) => s.id !== id));
  scopeContainerMappings.update((ms) => ms.filter((m) => m.scopeId !== id));
}

export function addContainerToScope(
  containerId: string,
  scopeId: string,
  position: { x: number; y: number }
) {
  scopeContainerMappings.update((ms) => {
    // Check if already exists
    const existing = ms.find(
      (m) => m.containerId === containerId && m.scopeId === scopeId
    );
    if (existing) return ms;
    return [...ms, { containerId, scopeId, position }];
  });
}

export function removeContainerFromScope(containerId: string, scopeId: string) {
  scopeContainerMappings.update((ms) =>
    ms.filter((m) => !(m.containerId === containerId && m.scopeId === scopeId))
  );
}

export function updateContainerPosition(
  containerId: string,
  scopeId: string,
  position: { x: number; y: number }
) {
  scopeContainerMappings.update((ms) =>
    ms.map((m) =>
      m.containerId === containerId && m.scopeId === scopeId
        ? { ...m, position }
        : m
    )
  );
}

export function addJoinableRelation(container1Id: string, container2Id: string) {
  joinableRelations.update((rs) => {
    // Check if already exists (symmetric)
    const exists = rs.some(
      (r) =>
        (r.container1Id === container1Id && r.container2Id === container2Id) ||
        (r.container1Id === container2Id && r.container2Id === container1Id)
    );
    if (exists) return rs;
    return [...rs, { container1Id, container2Id }];
  });
}

export function removeJoinableRelation(container1Id: string, container2Id: string) {
  joinableRelations.update((rs) =>
    rs.filter(
      (r) =>
        !(r.container1Id === container1Id && r.container2Id === container2Id) &&
        !(r.container1Id === container2Id && r.container2Id === container1Id)
    )
  );
}

// ============================================================================
// SERIALIZATION
// ============================================================================

export function exportEnvironment(): EnvironmentState {
  return {
    containers: get(containers),
    scopes: get(scopes),
    joinableRelations: get(joinableRelations),
    scopeContainerMappings: get(scopeContainerMappings),
  };
}

export function importEnvironment(state: EnvironmentState) {
  containers.set(state.containers);
  scopes.set(state.scopes);
  joinableRelations.set(state.joinableRelations);
  scopeContainerMappings.set(state.scopeContainerMappings);
}

// ============================================================================
// DEMO DATA
// ============================================================================

export function loadDemoData() {
  // Healthcare scenario from the paper
  const demoContainers: DataContainer[] = [
    { id: "providers-info", name: "ProvidersInfo", parentId: null, type: "table" },
    { id: "providers-name", name: "name", parentId: "providers-info", type: "column" },
    { id: "providers-ssn", name: "ssn", parentId: "providers-info", type: "column" },
    { id: "providers-vax-date", name: "vaccinationDate", parentId: "providers-info", type: "column" },

    { id: "patient-info", name: "PatientInfo", parentId: null, type: "table" },
    { id: "patient-mrn", name: "mrn", parentId: "patient-info", type: "column" },
    { id: "patient-name", name: "name", parentId: "patient-info", type: "column" },

    { id: "patient-encounters", name: "PatientEncounters", parentId: null, type: "table" },
    { id: "encounter-date", name: "date", parentId: "patient-encounters", type: "column" },

    { id: "patient-treatments", name: "PatientTreatments", parentId: null, type: "table" },
    { id: "treatment-diagnosis", name: "diagnosis", parentId: "patient-treatments", type: "column" },
    { id: "treatment-procedure", name: "procedure", parentId: "patient-treatments", type: "column" },
  ];

  const demoScopes: GovernanceScope[] = [
    { id: "hr-scope", name: "HRScope", description: "HR system context", color: "#4299e1" },
    { id: "medical-scope", name: "MedicalScope", description: "Clinical system context", color: "#48bb78" },
    { id: "research-scope", name: "ResearchScope", description: "Research context (cross-system)", color: "#ed8936" },
  ];

  const demoJoinable: JoinableRelation[] = [
    { container1Id: "providers-info", container2Id: "patient-encounters" },
    { container1Id: "providers-info", container2Id: "patient-treatments" },
    { container1Id: "patient-info", container2Id: "patient-encounters" },
    { container1Id: "patient-info", container2Id: "patient-treatments" },
    { container1Id: "patient-encounters", container2Id: "patient-treatments" },
  ];

  const demoMappings: ScopeContainerMapping[] = [
    // HR Scope - only providers
    { scopeId: "hr-scope", containerId: "providers-info", position: { x: 50, y: 80 } },

    // Medical Scope - patient tables
    { scopeId: "medical-scope", containerId: "patient-info", position: { x: 50, y: 80 } },
    { scopeId: "medical-scope", containerId: "patient-encounters", position: { x: 250, y: 80 } },
    { scopeId: "medical-scope", containerId: "patient-treatments", position: { x: 450, y: 80 } },

    // Research Scope - everything
    { scopeId: "research-scope", containerId: "providers-info", position: { x: 50, y: 80 } },
    { scopeId: "research-scope", containerId: "patient-info", position: { x: 300, y: 80 } },
    { scopeId: "research-scope", containerId: "patient-encounters", position: { x: 550, y: 80 } },
    { scopeId: "research-scope", containerId: "patient-treatments", position: { x: 300, y: 280 } },
  ];

  containers.set(demoContainers);
  scopes.set(demoScopes);
  joinableRelations.set(demoJoinable);
  scopeContainerMappings.set(demoMappings);
}
