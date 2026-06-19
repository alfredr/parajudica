<!--
  ContainerNode.svelte

  Represents a data container (database, table, or column).
  Highlights when hovering over any copy of the same container in other scopes.
  Displays compliance labels when analysis is run.
-->
<script lang="ts">
  import { Handle, Position } from "@xyflow/svelte";
  import type { NodeProps } from "@xyflow/svelte";
  import { hoveredContainerId } from "$lib/stores/environment";
  import {
    labelsPerContainer,
    comparisonMode,
    differingLabels,
    type LabelInfo,
  } from "$lib/stores/compliance";

  type $$Props = NodeProps;

  // Node ID passed by SvelteFlow (used for edge connections)
  export const id: string = "";
  export let data: {
    containerId: string;
    name: string;
    type: "database" | "table" | "column";
    scopeId: string;
    children?: { id: string; name: string; type: string }[];
  };
  export let selected: boolean = false;

  // Check if this container (or a copy of it) is being hovered
  $: isHighlighted = $hoveredContainerId === data.containerId;

  // Get labels for this container from compliance analysis
  $: containerLabels = $labelsPerContainer.get(data.containerId);
  $: allLabels = containerLabels
    ? Array.from(containerLabels.values()).flat()
    : [];

  // Deduplicate labels by name (keep first occurrence with framework color)
  $: uniqueLabels = deduplicateLabels(allLabels);

  // Get differing labels for comparison mode
  $: diffLabels = $differingLabels.get(data.containerId) ?? new Set<string>();

  function deduplicateLabels(labels: LabelInfo[]): LabelInfo[] {
    const seen = new Map<string, LabelInfo>();
    for (const label of labels) {
      if (!seen.has(label.name)) {
        seen.set(label.name, label);
      }
    }
    return Array.from(seen.values());
  }

  function shouldShowLabel(label: LabelInfo): boolean {
    if (!$comparisonMode) return true;
    return diffLabels.has(label.id);
  }

  function handleMouseEnter() {
    hoveredContainerId.set(data.containerId);
  }

  function handleMouseLeave() {
    hoveredContainerId.set(null);
  }

  // Icon based on type
  const typeIcons = {
    database: "🗄️",
    table: "📋",
    column: "📊",
  };

  // Colors based on type
  const typeColors = {
    database: { bg: "#f0f4f8", border: "#4a5568", text: "#2d3748" },
    table: { bg: "#ebf8ff", border: "#3182ce", text: "#2b6cb0" },
    column: { bg: "#f0fff4", border: "#38a169", text: "#276749" },
  };

  $: colors = typeColors[data.type];
</script>

<div
  class="container-node"
  class:selected
  class:highlighted={isHighlighted}
  style:--bg-color={colors.bg}
  style:--border-color={colors.border}
  style:--text-color={colors.text}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  role="button"
  tabindex="0"
>
  <!-- Input handle for containment edges from parent -->
  <Handle type="target" position={Position.Top} class="handle" />

  <div class="header">
    <span class="icon">{typeIcons[data.type]}</span>
    <span class="name">{data.name}</span>
    <span class="type-badge">{data.type}</span>
  </div>

  {#if data.children && data.children.length > 0}
    <div class="children">
      {#each data.children as child}
        <div class="child-row">
          <span class="child-icon">{typeIcons[child.type] ?? "•"}</span>
          <span class="child-name">{child.name}</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if uniqueLabels.length > 0}
    <div class="labels">
      {#each uniqueLabels as label}
        {#if shouldShowLabel(label)}
          <span
            class="label-badge"
            class:differing={$comparisonMode && diffLabels.has(label.id)}
            style:--label-color={label.frameworkColor}
            title="{label.facetName}: {label.name}"
          >
            {label.name}
          </span>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Output handle for containment edges to children -->
  <Handle type="source" position={Position.Bottom} class="handle" />

  <!-- Side handles for joinable edges -->
  <Handle
    type="source"
    position={Position.Right}
    id="joinable-out"
    class="handle joinable-handle"
  />
  <Handle
    type="target"
    position={Position.Left}
    id="joinable-in"
    class="handle joinable-handle"
  />
</div>

<style>
  .container-node {
    background: var(--bg-color);
    border: 2px solid var(--border-color);
    border-radius: 8px;
    padding: 0;
    min-width: 160px;
    font-size: 12px;
    transition: all 0.15s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .container-node:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .container-node.selected {
    border-width: 3px;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--border-color) 30%, transparent);
  }

  .container-node.highlighted {
    border-color: #e53e3e;
    background: #fff5f5;
    box-shadow: 0 0 0 3px rgba(229, 62, 62, 0.3), 0 4px 12px rgba(229, 62, 62, 0.2);
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
  }

  .header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid color-mix(in srgb, var(--border-color) 20%, transparent);
  }

  .icon {
    font-size: 14px;
  }

  .name {
    flex: 1;
    font-weight: 600;
    color: var(--text-color);
  }

  .type-badge {
    font-size: 9px;
    text-transform: uppercase;
    padding: 2px 5px;
    background: var(--border-color);
    color: white;
    border-radius: 3px;
    font-weight: 500;
  }

  .children {
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .child-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #666;
    padding: 2px 4px;
    border-radius: 3px;
  }

  .child-row:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .child-icon {
    font-size: 10px;
    opacity: 0.7;
  }

  .child-name {
    font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
  }

  .labels {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 10px;
    border-top: 1px solid color-mix(in srgb, var(--border-color) 20%, transparent);
  }

  .label-badge {
    font-size: 9px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--label-color);
    color: white;
    white-space: nowrap;
    cursor: default;
  }

  .label-badge.differing {
    animation: highlight-pulse 1s ease-in-out infinite;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8);
  }

  @keyframes highlight-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  :global(.handle) {
    width: 8px;
    height: 8px;
    background: var(--border-color);
    border: 2px solid white;
  }

  :global(.handle.joinable-handle) {
    background: #9f7aea;
    border-radius: 2px;
  }
</style>
