<!--
  App.svelte

  Main application component for the Parajudica Data Environment Visualizer.
  Uses Svelte Flow to render a graphical representation of data containers
  organized into governance scopes.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import {
    SvelteFlow,
    Controls,
    Background,
    MiniMap,
    type Node,
    type Edge,
    type NodeTypes,
    type EdgeTypes,
    BackgroundVariant,
  } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";

  import EnvironmentNode from "$lib/components/nodes/EnvironmentNode.svelte";
  import ContainerNode from "$lib/components/nodes/ContainerNode.svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import FrameworkPanel from "$lib/components/FrameworkPanel.svelte";
  import {
    containers,
    scopes,
    joinableRelations,
    scopeContainerMappings,
    hoveredContainerId,
    selectedNodeId,
    loadDemoData,
    type DataContainer,
  } from "$lib/stores/environment";
  import { layoutContainersInScope } from "$lib/layout/dagre";

  // Custom node types
  const nodeTypes: NodeTypes = {
    environment: EnvironmentNode,
    container: ContainerNode,
  };

  // Node and edge state
  let nodes: Node[] = $state([]);
  let edges: Edge[] = $state([]);

  // Layout constants
  const SCOPE_PADDING = 40;
  const SCOPE_GAP = 50;
  const CONTAINER_WIDTH = 180;
  const CONTAINER_HEIGHT = 100;

  // Build nodes and edges from store state
  function buildFlowElements() {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Get current store values
    const currentScopes = $scopes;
    const currentContainers = $containers;
    const currentMappings = $scopeContainerMappings;
    const currentJoinable = $joinableRelations;

    // Build container lookup
    const containerMap = new Map<string, DataContainer>();
    for (const c of currentContainers) {
      containerMap.set(c.id, c);
    }

    // Build children lookup
    const childrenMap = new Map<string, DataContainer[]>();
    for (const c of currentContainers) {
      if (c.parentId) {
        const siblings = childrenMap.get(c.parentId) ?? [];
        siblings.push(c);
        childrenMap.set(c.parentId, siblings);
      }
    }

    // Create scope nodes
    let scopeX = SCOPE_GAP;
    for (const scope of currentScopes) {
      // Get containers in this scope (top-level only)
      const mappingsInScope = currentMappings.filter((m) => m.scopeId === scope.id);
      const topLevelContainerIds = mappingsInScope
        .filter((m) => {
          const container = containerMap.get(m.containerId);
          return container && !container.parentId;
        })
        .map((m) => m.containerId);

      // Calculate actual heights for each container based on children
      const nodeHeights = new Map<string, number>();
      for (const containerId of topLevelContainerIds) {
        const children = childrenMap.get(containerId) ?? [];
        // Base height + ~24px per child row
        const height = CONTAINER_HEIGHT + children.length * 24;
        nodeHeights.set(containerId, height);
      }

      // Use dagre to layout containers based on joinable relations
      const layoutedPositions = layoutContainersInScope(
        topLevelContainerIds,
        currentJoinable,
        {
          direction: "LR", // Left-to-right matches side handles
          nodeWidth: CONTAINER_WIDTH,
          nodeHeight: CONTAINER_HEIGHT,
          nodeSep: 60,
          rankSep: 100,
          marginX: SCOPE_PADDING,
          marginY: SCOPE_PADDING + 30, // Extra for scope label
        },
        nodeHeights
      );

      // Calculate scope size based on layouted positions
      let maxX = 200;
      let maxY = 150;
      for (const containerId of topLevelContainerIds) {
        const pos = layoutedPositions.get(containerId);
        if (pos) {
          const children = childrenMap.get(containerId) ?? [];
          const containerHeight = CONTAINER_HEIGHT + children.length * 24;
          maxX = Math.max(maxX, pos.x + CONTAINER_WIDTH + SCOPE_PADDING);
          maxY = Math.max(maxY, pos.y + containerHeight + SCOPE_PADDING);
        }
      }

      newNodes.push({
        id: `scope-${scope.id}`,
        type: "environment",
        position: { x: scopeX, y: SCOPE_GAP },
        data: {
          label: scope.name,
          description: scope.description,
          color: scope.color,
          width: maxX,
          height: maxY,
        },
        zIndex: -1,
        selectable: true,
        draggable: true,
      });

      // Create container nodes within this scope using layouted positions
      // Note: position is relative to parent when parentId is set
      for (const containerId of topLevelContainerIds) {
        const container = containerMap.get(containerId);
        if (!container) continue;

        const pos = layoutedPositions.get(containerId) ?? { x: SCOPE_PADDING, y: SCOPE_PADDING + 20 };
        const children = childrenMap.get(container.id) ?? [];
        const nodeId = `${scope.id}-${container.id}`;

        newNodes.push({
          id: nodeId,
          type: "container",
          position: {
            x: pos.x,  // Relative to parent scope
            y: pos.y,
          },
          data: {
            containerId: container.id,
            name: container.name,
            type: container.type,
            scopeId: scope.id,
            children: children.map((c) => ({
              id: c.id,
              name: c.name,
              type: c.type,
            })),
          },
          parentId: `scope-${scope.id}`,
          extent: "parent",
          draggable: true,
        });
      }

      scopeX += maxX + SCOPE_GAP;
    }

    // Create joinable edges
    for (const relation of currentJoinable) {
      // Find all instances of each container across scopes
      const container1Nodes = newNodes.filter(
        (n) => n.type === "container" && n.data.containerId === relation.container1Id
      );
      const container2Nodes = newNodes.filter(
        (n) => n.type === "container" && n.data.containerId === relation.container2Id
      );

      // Create edges between containers in the same scope
      for (const n1 of container1Nodes) {
        for (const n2 of container2Nodes) {
          if (n1.data.scopeId === n2.data.scopeId) {
            newEdges.push({
              id: `joinable-${n1.id}-${n2.id}`,
              source: n1.id,
              target: n2.id,
              sourceHandle: "joinable-out",
              targetHandle: "joinable-in",
              type: "default",
              style: "stroke: #9f7aea; stroke-width: 2; stroke-dasharray: 5,5;",
              animated: true,
              label: "⋈",
              labelStyle: "font-size: 14px; fill: #9f7aea;",
            });
          }
        }
      }
    }

    nodes = newNodes;
    edges = newEdges;
  }

  // Rebuild when stores change
  $effect(() => {
    // Subscribe to all relevant stores
    const _ = [$scopes, $containers, $scopeContainerMappings, $joinableRelations];
    buildFlowElements();
  });

  // Load demo data on mount
  onMount(() => {
    loadDemoData();
  });

  // Handle node selection
  function handleNodeClick(event: CustomEvent) {
    const node = event.detail.node;
    if (node.type === "container") {
      selectedNodeId.set(node.data.containerId);
    } else if (node.type === "environment") {
      selectedNodeId.set(node.id);
    }
  }

  // Handle node drag
  function handleNodeDragStop(event: CustomEvent) {
    const node = event.detail.node;
    // Could update position in store here
  }
</script>

<div class="app">
  <header class="header">
    <h1>Parajudica</h1>
    <span class="subtitle">Data Environment Visualizer</span>
    <div class="spacer"></div>
    <button class="btn" onclick={() => loadDemoData()}>Load Demo</button>
  </header>

  <div class="main">
    <Sidebar />

    <div class="canvas">
      <SvelteFlow
        {nodes}
        {edges}
        {nodeTypes}
        fitView
        snapToGrid
        snapGrid={[10, 10]}
        on:nodeclick={handleNodeClick}
        on:nodedragstop={handleNodeDragStop}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === "environment") return node.data.color;
            return "#e2e8f0";
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </SvelteFlow>
    </div>

    <FrameworkPanel />
  </div>
</div>

<style>
  .app {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #f7fafc;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .header h1 {
    font-size: 20px;
    font-weight: 700;
    color: #2d3748;
    margin: 0;
  }

  .subtitle {
    font-size: 13px;
    color: #718096;
  }

  .spacer {
    flex: 1;
  }

  .btn {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    color: white;
    background: #4299e1;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn:hover {
    background: #3182ce;
  }

  .main {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .canvas {
    flex: 1;
    position: relative;
  }
</style>
