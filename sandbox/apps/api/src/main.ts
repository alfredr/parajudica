/**
 * Parajudica API
 *
 * Hono-based REST API for the compliance inference engine.
 * Provides endpoints for:
 * - Running inference on compliance environments
 * - Querying assertions
 * - Comparing frameworks
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
  ComplianceInferenceEngine,
  infer,
  queryAssertions,
  getLabelsForContainer,
  compareFrameworks,
  BaseFramework,
  HIPAAFramework,
  GDPRFramework,
  ItalianDPAFramework,
  type ComplianceEnvironment,
} from "@parajudica/engine";
import {
  type ContainerId,
  type ScopeId,
  type FrameworkId,
  type LabelId,
  Id,
} from "@parajudica/schema";

// ============================================================================
// APP SETUP
// ============================================================================

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Health check
 */
app.get("/", (c) => {
  return c.json({
    name: "Parajudica API",
    version: "0.1.0",
    description: "Compliance inference engine API",
  });
});

/**
 * Get available frameworks
 */
app.get("/frameworks", (c) => {
  const frameworks = [
    BaseFramework.framework,
    ...HIPAAFramework.frameworks,
    ...GDPRFramework.frameworks,
    ...ItalianDPAFramework.frameworks,
  ];

  return c.json({
    frameworks: frameworks.map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      type: f.type,
      extendsId: f.extendsId,
    })),
  });
});

/**
 * Get labels for a framework
 */
app.get("/frameworks/:frameworkId/labels", (c) => {
  const frameworkId = c.req.param("frameworkId");

  // Collect labels from all frameworks
  const allLabels = [
    ...BaseFramework.labels,
    ...HIPAAFramework.labels,
    ...GDPRFramework.labels,
    ...ItalianDPAFramework.labels,
  ];

  const labels = allLabels.filter((l) => l.frameworkId === frameworkId);

  return c.json({ labels });
});

/**
 * Run inference on a compliance environment
 *
 * POST /infer
 * Body: ComplianceEnvironment (JSON)
 */
app.post("/infer", async (c) => {
  try {
    const body = await c.req.json();
    const env = body as ComplianceEnvironment;

    const startTime = Date.now();
    const result = infer(env, {
      enableMetrics: true,
      onProgress: (iteration, newAssertions) => {
        console.log(`Iteration ${iteration}: ${newAssertions} new assertions`);
      },
    });
    const endTime = Date.now();

    return c.json({
      success: true,
      result: {
        assertions: result.assertions,
        containmentAssertions: result.containmentAssertions,
        iterations: result.iterations,
        metrics: {
          ...result.metrics,
          wallTimeMs: endTime - startTime,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ success: false, error: message }, 400);
  }
});

/**
 * Query assertions from a previous inference result
 *
 * POST /query
 * Body: { result: InferenceResult, query: QueryParams }
 */
app.post("/query", async (c) => {
  try {
    const body = await c.req.json();
    const { result, query } = body;

    const assertions = queryAssertions(result, {
      containerId: query.containerId as ContainerId | undefined,
      labelId: query.labelId as LabelId | undefined,
      scopeId: query.scopeId as ScopeId | undefined,
      frameworkId: query.frameworkId as FrameworkId | undefined,
      isGround: query.isGround,
    });

    return c.json({ assertions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ success: false, error: message }, 400);
  }
});

/**
 * Compare frameworks for a container
 *
 * POST /compare
 * Body: { result: InferenceResult, containerId: string, scopeId: string }
 */
app.post("/compare", async (c) => {
  try {
    const body = await c.req.json();
    const { result, containerId, scopeId } = body;

    const comparison = compareFrameworks(
      result,
      containerId as ContainerId,
      scopeId as ScopeId
    );

    return c.json({ comparison });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ success: false, error: message }, 400);
  }
});

/**
 * Get all labels for a container in a scope
 *
 * POST /labels
 * Body: { result: InferenceResult, containerId: string, scopeId: string }
 */
app.post("/labels", async (c) => {
  try {
    const body = await c.req.json();
    const { result, containerId, scopeId } = body;

    const labelsByFramework = getLabelsForContainer(
      result,
      containerId as ContainerId,
      scopeId as ScopeId
    );

    // Convert Map to object for JSON serialization
    const labels: Record<string, string[]> = {};
    for (const [framework, frameworkLabels] of labelsByFramework) {
      labels[framework] = frameworkLabels;
    }

    return c.json({ labels });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ success: false, error: message }, 400);
  }
});

/**
 * Build a complete environment with bundled frameworks
 *
 * POST /build-environment
 * Body: { containers, joinableRelations, scopes, groundAssertions, frameworkIds }
 */
app.post("/build-environment", async (c) => {
  try {
    const body = await c.req.json();
    const {
      containers,
      joinableRelations,
      scopes,
      groundAssertions,
      frameworkIds,
    } = body;

    // Collect requested frameworks
    const allFrameworks = [
      BaseFramework.framework,
      ...HIPAAFramework.frameworks,
      ...GDPRFramework.frameworks,
      ...ItalianDPAFramework.frameworks,
    ];

    const allFacets = [
      ...BaseFramework.facets,
      ...HIPAAFramework.facets,
      ...GDPRFramework.facets,
      ...ItalianDPAFramework.facets,
    ];

    const allLabels = [
      ...BaseFramework.labels,
      ...HIPAAFramework.labels,
      ...GDPRFramework.labels,
      ...ItalianDPAFramework.labels,
    ];

    const allSubclassRules = [
      ...BaseFramework.subclassRules,
      ...HIPAAFramework.subclassRules,
      ...GDPRFramework.subclassRules,
      ...ItalianDPAFramework.subclassRules,
    ];

    const allEquivalenceRules = [
      ...BaseFramework.equivalenceRules,
      ...HIPAAFramework.equivalenceRules,
      ...GDPRFramework.equivalenceRules,
      ...ItalianDPAFramework.equivalenceRules,
    ];

    const allImplicationRules = [
      ...BaseFramework.implicationRules,
      ...HIPAAFramework.implicationRules,
      ...GDPRFramework.implicationRules,
      ...ItalianDPAFramework.implicationRules,
    ];

    const allPropagationRules = [
      ...BaseFramework.propagationRules,
      ...HIPAAFramework.propagationRules,
      ...GDPRFramework.propagationRules,
      ...ItalianDPAFramework.propagationRules,
    ];

    // Filter to requested frameworks (if specified)
    const frameworkSet = frameworkIds
      ? new Set(frameworkIds as string[])
      : null;

    const filterByFramework = <T extends { frameworkId: FrameworkId }>(
      items: T[]
    ): T[] => {
      if (!frameworkSet) return items;
      return items.filter((item) => frameworkSet.has(item.frameworkId));
    };

    const env: ComplianceEnvironment = {
      containers,
      joinableRelations,
      scopes,
      frameworks: frameworkSet
        ? allFrameworks.filter((f) => frameworkSet.has(f.id))
        : allFrameworks,
      facets: filterByFramework(allFacets),
      labels: filterByFramework(allLabels),
      subclassRules: filterByFramework(allSubclassRules),
      equivalenceRules: filterByFramework(allEquivalenceRules),
      implicationRules: filterByFramework(allImplicationRules),
      propagationRules: filterByFramework(allPropagationRules),
      groundAssertions,
    };

    return c.json({ environment: env });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ success: false, error: message }, 400);
  }
});

// ============================================================================
// SERVER
// ============================================================================

const port = parseInt(Deno.env.get("PORT") ?? "3000");

console.log(`Parajudica API starting on port ${port}...`);

Deno.serve({ port }, app.fetch);
