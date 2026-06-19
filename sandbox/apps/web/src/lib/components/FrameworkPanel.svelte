<!--
  FrameworkPanel.svelte

  Panel for selecting compliance frameworks and viewing analysis results.
-->
<script lang="ts">
  import {
    frameworkRegistry,
    selectedFrameworkIds,
    analysisResult,
    isAnalyzing,
    comparisonMode,
    toggleFramework,
    selectAllFrameworks,
    clearFrameworks,
    runAnalysis,
    clearResults,
    type FrameworkInfo,
  } from "$lib/stores/compliance";
  import type { FrameworkId } from "@parajudica/schema";

  // Group frameworks by parent
  function getMainFrameworks(): FrameworkInfo[] {
    return frameworkRegistry.filter((f) => !f.isSubFramework);
  }

  function getSubFrameworks(parentId: FrameworkId): FrameworkInfo[] {
    return frameworkRegistry.filter((f) => f.parentId === parentId);
  }

  function isSelected(id: FrameworkId): boolean {
    return $selectedFrameworkIds.has(id);
  }

  function handleToggle(id: FrameworkId) {
    toggleFramework(id);
  }

  async function handleRunAnalysis() {
    await runAnalysis();
  }
</script>

<aside class="panel">
  <div class="header">
    <h2>Compliance Analysis</h2>
  </div>

  <div class="content">
    <section class="section">
      <div class="section-header">
        <h3>Frameworks</h3>
        <div class="actions">
          <button class="link-btn" onclick={selectAllFrameworks}>All</button>
          <span class="separator">|</span>
          <button class="link-btn" onclick={clearFrameworks}>None</button>
        </div>
      </div>

      <div class="framework-list">
        {#each getMainFrameworks() as framework}
          <div class="framework-group">
            <label class="framework-item">
              <input
                type="checkbox"
                checked={isSelected(framework.id)}
                onchange={() => handleToggle(framework.id)}
              />
              <span
                class="color-indicator"
                style:background={framework.color}
              ></span>
              <span class="framework-name">{framework.name}</span>
            </label>

            {#each getSubFrameworks(framework.id) as subFramework}
              <label class="framework-item sub">
                <input
                  type="checkbox"
                  checked={isSelected(subFramework.id)}
                  onchange={() => handleToggle(subFramework.id)}
                />
                <span
                  class="color-indicator"
                  style:background={subFramework.color}
                ></span>
                <span class="framework-name">{subFramework.name}</span>
              </label>
            {/each}
          </div>
        {/each}
      </div>
    </section>

    <section class="section">
      <button
        class="btn primary full-width"
        onclick={handleRunAnalysis}
        disabled={$isAnalyzing || $selectedFrameworkIds.size === 0}
      >
        {#if $isAnalyzing}
          Analyzing...
        {:else}
          Run Analysis
        {/if}
      </button>

      {#if $analysisResult}
        <button class="btn secondary full-width" onclick={clearResults}>
          Clear Results
        </button>
      {/if}
    </section>

    {#if $analysisResult}
      <section class="section results">
        <h3>Results</h3>

        <div class="stats">
          <div class="stat">
            <span class="stat-value">{$analysisResult.assertions.length}</span>
            <span class="stat-label">Assertions</span>
          </div>
          <div class="stat">
            <span class="stat-value">{$analysisResult.iterations}</span>
            <span class="stat-label">Iterations</span>
          </div>
          <div class="stat">
            <span class="stat-value">{$analysisResult.metrics.totalTimeMs.toFixed(0)}ms</span>
            <span class="stat-label">Time</span>
          </div>
        </div>

        <div class="rule-stats">
          <div class="rule-stat">
            <span class="rule-count">{$analysisResult.metrics.ruleApplications.subclass}</span>
            <span class="rule-type">Subclass</span>
          </div>
          <div class="rule-stat">
            <span class="rule-count">{$analysisResult.metrics.ruleApplications.equivalence}</span>
            <span class="rule-type">Equivalence</span>
          </div>
          <div class="rule-stat">
            <span class="rule-count">{$analysisResult.metrics.ruleApplications.implication}</span>
            <span class="rule-type">Implication</span>
          </div>
          <div class="rule-stat">
            <span class="rule-count">{$analysisResult.metrics.ruleApplications.propagation}</span>
            <span class="rule-type">Propagation</span>
          </div>
        </div>
      </section>

      <section class="section">
        <label class="toggle-item">
          <input
            type="checkbox"
            bind:checked={$comparisonMode}
          />
          <span class="toggle-label">Comparison Mode</span>
          <span class="toggle-desc">Highlight differing labels</span>
        </label>
      </section>
    {/if}
  </div>
</aside>

<style>
  .panel {
    width: 260px;
    background: white;
    border-left: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .header {
    padding: 12px 16px;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .header h2 {
    font-size: 14px;
    font-weight: 600;
    color: #2d3748;
    margin: 0;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .section {
    margin-bottom: 16px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .section h3 {
    font-size: 11px;
    font-weight: 600;
    color: #718096;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .link-btn {
    background: none;
    border: none;
    color: #4299e1;
    font-size: 11px;
    cursor: pointer;
    padding: 0;
  }

  .link-btn:hover {
    text-decoration: underline;
  }

  .separator {
    color: #cbd5e0;
    font-size: 11px;
  }

  .framework-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .framework-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .framework-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: background 0.15s;
  }

  .framework-item:hover {
    background: #f7fafc;
  }

  .framework-item.sub {
    padding-left: 28px;
  }

  .framework-item input[type="checkbox"] {
    width: 14px;
    height: 14px;
    cursor: pointer;
  }

  .color-indicator {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .framework-name {
    color: #4a5568;
  }

  .btn {
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn.full-width {
    width: 100%;
    margin-bottom: 8px;
  }

  .btn.primary {
    background: #4299e1;
    color: white;
  }

  .btn.primary:hover:not(:disabled) {
    background: #3182ce;
  }

  .btn.primary:disabled {
    background: #a0aec0;
    cursor: not-allowed;
  }

  .btn.secondary {
    background: #edf2f7;
    color: #4a5568;
  }

  .btn.secondary:hover {
    background: #e2e8f0;
  }

  .results h3 {
    margin-bottom: 12px;
  }

  .stats {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .stat {
    flex: 1;
    text-align: center;
    padding: 8px;
    background: #f7fafc;
    border-radius: 6px;
  }

  .stat-value {
    display: block;
    font-size: 18px;
    font-weight: 600;
    color: #2d3748;
  }

  .stat-label {
    font-size: 10px;
    color: #718096;
    text-transform: uppercase;
  }

  .rule-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .rule-stat {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: #f7fafc;
    border-radius: 4px;
    font-size: 11px;
  }

  .rule-count {
    font-weight: 600;
    color: #4299e1;
  }

  .rule-type {
    color: #718096;
  }

  .toggle-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: #f7fafc;
    border-radius: 6px;
    cursor: pointer;
  }

  .toggle-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
  }

  .toggle-label {
    font-size: 12px;
    font-weight: 500;
    color: #2d3748;
  }

  .toggle-desc {
    width: 100%;
    font-size: 11px;
    color: #718096;
    padding-left: 24px;
  }
</style>
