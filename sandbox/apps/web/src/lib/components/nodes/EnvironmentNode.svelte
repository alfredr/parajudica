<!--
  EnvironmentNode.svelte

  Represents a governance scope as a dashed-border container.
  Child container nodes are positioned within this boundary.
-->
<script lang="ts">
  import { Handle, Position } from "@xyflow/svelte";
  import type { NodeProps } from "@xyflow/svelte";

  type $$Props = NodeProps;

  export let data: {
    label: string;
    description?: string;
    color: string;
    width: number;
    height: number;
  };

  export let selected: boolean = false;
</script>

<div
  class="environment"
  class:selected
  style:width="{data.width}px"
  style:height="{data.height}px"
  style:--scope-color={data.color}
>
  <div class="label-container">
    <span class="label">{data.label}</span>
    {#if data.description}
      <span class="description">{data.description}</span>
    {/if}
  </div>
</div>

<style>
  .environment {
    border: 2px dashed var(--scope-color, #666);
    border-radius: 12px;
    background: color-mix(in srgb, var(--scope-color) 5%, transparent);
    position: relative;
    min-width: 200px;
    min-height: 150px;
    transition: all 0.2s ease;
  }

  .environment:hover {
    background: color-mix(in srgb, var(--scope-color) 10%, transparent);
  }

  .environment.selected {
    border-width: 3px;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--scope-color) 30%, transparent);
  }

  .label-container {
    position: absolute;
    top: -12px;
    left: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: white;
    padding: 2px 10px;
    border-radius: 4px;
  }

  .label {
    font-size: 13px;
    font-weight: 600;
    color: var(--scope-color, #666);
  }

  .description {
    font-size: 11px;
    color: #888;
    font-style: italic;
  }
</style>
