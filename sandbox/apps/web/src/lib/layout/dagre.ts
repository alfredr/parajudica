/**
 * Dagre Layout Utility
 *
 * Uses dagre to automatically layout nodes within governance scopes.
 */

import dagre from "@dagrejs/dagre";
import { Position, type Node, type Edge } from "@xyflow/svelte";

// Default node dimensions for layout calculation
const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 100;

export interface LayoutOptions {
  direction?: "TB" | "LR" | "BT" | "RL";
  nodeWidth?: number;
  nodeHeight?: number;
  nodeSep?: number;
  rankSep?: number;
  marginX?: number;
  marginY?: number;
}

/**
 * Layout nodes using dagre algorithm
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[]; width: number; height: number } {
  const {
    direction = "TB",
    nodeWidth = DEFAULT_NODE_WIDTH,
    nodeHeight = DEFAULT_NODE_HEIGHT,
    nodeSep = 50,
    rankSep = 80,
    marginX = 40,
    marginY = 60,
  } = options;

  const isHorizontal = direction === "LR" || direction === "RL";

  // Create a new dagre graph
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: marginX,
    marginy: marginY,
  });

  // Add nodes to dagre
  for (const node of nodes) {
    const width = (node.measured?.width ?? node.width ?? nodeWidth) as number;
    const height = (node.measured?.height ?? node.height ?? nodeHeight) as number;
    dagreGraph.setNode(node.id, { width, height });
  }

  // Add edges to dagre
  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target);
  }

  // Run the layout algorithm
  dagre.layout(dagreGraph);

  // Calculate bounds
  let maxX = 0;
  let maxY = 0;

  // Map the positions back to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const width = (node.measured?.width ?? node.width ?? nodeWidth) as number;
    const height = (node.measured?.height ?? node.height ?? nodeHeight) as number;

    // Dagre uses center anchor, convert to top-left
    const x = nodeWithPosition.x - width / 2;
    const y = nodeWithPosition.y - height / 2;

    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);

    return {
      ...node,
      position: { x, y },
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
    };
  });

  return {
    nodes: layoutedNodes,
    edges,
    width: maxX + marginX,
    height: maxY + marginY,
  };
}

/**
 * Layout containers within a scope based on joinable relationships
 */
export function layoutContainersInScope(
  containerIds: string[],
  joinableRelations: Array<{ container1Id: string; container2Id: string }>,
  options: LayoutOptions = {},
  nodeHeights?: Map<string, number>
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  if (containerIds.length === 0) {
    return positions;
  }

  const {
    direction = "TB",
    nodeWidth = DEFAULT_NODE_WIDTH,
    nodeHeight = DEFAULT_NODE_HEIGHT,
    nodeSep = 50,
    rankSep = 80,
    marginX = 40,
    marginY = 60,
  } = options;

  const isHorizontal = direction === "LR" || direction === "RL";

  // Create a new dagre graph
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: marginX,
    marginy: marginY,
  });

  // Add nodes with proper dimensions
  for (const id of containerIds) {
    const height = nodeHeights?.get(id) ?? nodeHeight;
    dagreGraph.setNode(id, { width: nodeWidth, height });
  }

  // Create edges from joinable relations (only for containers in this scope)
  const containerSet = new Set(containerIds);
  for (const r of joinableRelations) {
    if (containerSet.has(r.container1Id) && containerSet.has(r.container2Id)) {
      dagreGraph.setEdge(r.container1Id, r.container2Id);
    }
  }

  // Run the layout algorithm
  dagre.layout(dagreGraph);

  // Extract positions (convert from center to top-left anchor)
  for (const id of containerIds) {
    const nodeWithPosition = dagreGraph.node(id);
    const height = nodeHeights?.get(id) ?? nodeHeight;
    positions.set(id, {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - height / 2,
    });
  }

  return positions;
}
