<!--
  Sidebar.svelte

  Editor panel for managing the data environment.
  Allows adding/editing containers, scopes, and joinable relationships.
-->
<script lang="ts">
  import {
    containers,
    scopes,
    joinableRelations,
    scopeContainerMappings,
    selectedNodeId,
    selectedScopeId,
    addContainer,
    updateContainer,
    removeContainer,
    addScope,
    updateScope,
    removeScope,
    addContainerToScope,
    removeContainerFromScope,
    addJoinableRelation,
    removeJoinableRelation,
    exportEnvironment,
    importEnvironment,
    type DataContainer,
    type GovernanceScope,
  } from "$lib/stores/environment";

  // Tab state
  let activeTab: "containers" | "scopes" | "joinable" = $state("containers");

  // Form state for new container
  let newContainerName = $state("");
  let newContainerType: "database" | "table" | "column" = $state("table");
  let newContainerParent: string | null = $state(null);

  // Form state for new scope
  let newScopeName = $state("");
  let newScopeDescription = $state("");
  let newScopeColor = $state("#4299e1");

  // Form state for joinable relation
  let joinableContainer1 = $state("");
  let joinableContainer2 = $state("");

  // Form state for adding container to scope
  let containerToAdd = $state("");
  let scopeToAddTo = $state("");

  // Get top-level containers for parent selection
  $effect(() => {
    const _ = $containers; // Subscribe
  });

  function handleAddContainer() {
    if (!newContainerName.trim()) return;
    addContainer({
      name: newContainerName.trim(),
      type: newContainerType,
      parentId: newContainerParent,
    });
    newContainerName = "";
    newContainerParent = null;
  }

  function handleAddScope() {
    if (!newScopeName.trim()) return;
    addScope({
      name: newScopeName.trim(),
      description: newScopeDescription.trim() || undefined,
      color: newScopeColor,
    });
    newScopeName = "";
    newScopeDescription = "";
  }

  function handleAddJoinable() {
    if (!joinableContainer1 || !joinableContainer2) return;
    if (joinableContainer1 === joinableContainer2) return;
    addJoinableRelation(joinableContainer1, joinableContainer2);
    joinableContainer1 = "";
    joinableContainer2 = "";
  }

  function handleAddToScope() {
    if (!containerToAdd || !scopeToAddTo) return;
    // Calculate position based on existing containers in scope
    const existingMappings = $scopeContainerMappings.filter(
      (m) => m.scopeId === scopeToAddTo
    );
    const x = 50 + (existingMappings.length % 3) * 200;
    const y = 80 + Math.floor(existingMappings.length / 3) * 150;
    addContainerToScope(containerToAdd, scopeToAddTo, { x, y });
    containerToAdd = "";
  }

  function handleExport() {
    const data = exportEnvironment();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "environment.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        importEnvironment(data);
      } catch (err) {
        console.error("Failed to import:", err);
        alert("Failed to import environment file");
      }
    };
    input.click();
  }

  // Type icons
  const typeIcons = {
    database: "🗄️",
    table: "📋",
    column: "📊",
  };
</script>

<aside class="sidebar">
  <div class="tabs">
    <button
      class="tab"
      class:active={activeTab === "containers"}
      onclick={() => (activeTab = "containers")}
    >
      Containers
    </button>
    <button
      class="tab"
      class:active={activeTab === "scopes"}
      onclick={() => (activeTab = "scopes")}
    >
      Scopes
    </button>
    <button
      class="tab"
      class:active={activeTab === "joinable"}
      onclick={() => (activeTab = "joinable")}
    >
      Joinable
    </button>
  </div>

  <div class="content">
    {#if activeTab === "containers"}
      <section class="section">
        <h3>Add Container</h3>
        <div class="form-group">
          <input
            type="text"
            placeholder="Container name"
            bind:value={newContainerName}
          />
        </div>
        <div class="form-row">
          <select bind:value={newContainerType}>
            <option value="database">Database</option>
            <option value="table">Table</option>
            <option value="column">Column</option>
          </select>
          <select bind:value={newContainerParent}>
            <option value={null}>No parent</option>
            {#each $containers.filter((c) => c.type !== "column") as container}
              <option value={container.id}>
                {typeIcons[container.type]} {container.name}
              </option>
            {/each}
          </select>
        </div>
        <button class="btn primary" onclick={handleAddContainer}>
          Add Container
        </button>
      </section>

      <section class="section">
        <h3>Containers ({$containers.length})</h3>
        <div class="list">
          {#each $containers.filter((c) => !c.parentId) as container}
            <div class="list-item">
              <span class="icon">{typeIcons[container.type]}</span>
              <span class="name">{container.name}</span>
              <button
                class="btn-icon danger"
                onclick={() => removeContainer(container.id)}
                title="Remove"
              >
                ×
              </button>
            </div>
            {#each $containers.filter((c) => c.parentId === container.id) as child}
              <div class="list-item indent">
                <span class="icon">{typeIcons[child.type]}</span>
                <span class="name">{child.name}</span>
                <button
                  class="btn-icon danger"
                  onclick={() => removeContainer(child.id)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            {/each}
          {/each}
        </div>
      </section>

      <section class="section">
        <h3>Add to Scope</h3>
        <div class="form-row">
          <select bind:value={containerToAdd}>
            <option value="">Select container...</option>
            {#each $containers.filter((c) => !c.parentId) as container}
              <option value={container.id}>{container.name}</option>
            {/each}
          </select>
          <select bind:value={scopeToAddTo}>
            <option value="">Select scope...</option>
            {#each $scopes as scope}
              <option value={scope.id}>{scope.name}</option>
            {/each}
          </select>
        </div>
        <button class="btn" onclick={handleAddToScope}>Add to Scope</button>
      </section>
    {:else if activeTab === "scopes"}
      <section class="section">
        <h3>Add Scope</h3>
        <div class="form-group">
          <input
            type="text"
            placeholder="Scope name"
            bind:value={newScopeName}
          />
        </div>
        <div class="form-group">
          <input
            type="text"
            placeholder="Description (optional)"
            bind:value={newScopeDescription}
          />
        </div>
        <div class="form-row">
          <label class="color-label">
            Color:
            <input type="color" bind:value={newScopeColor} />
          </label>
          <button class="btn primary" onclick={handleAddScope}>Add Scope</button
          >
        </div>
      </section>

      <section class="section">
        <h3>Scopes ({$scopes.length})</h3>
        <div class="list">
          {#each $scopes as scope}
            <div class="list-item">
              <span
                class="color-dot"
                style:background={scope.color}
              ></span>
              <div class="scope-info">
                <span class="name">{scope.name}</span>
                {#if scope.description}
                  <span class="description">{scope.description}</span>
                {/if}
              </div>
              <button
                class="btn-icon danger"
                onclick={() => removeScope(scope.id)}
                title="Remove"
              >
                ×
              </button>
            </div>
          {/each}
        </div>
      </section>
    {:else if activeTab === "joinable"}
      <section class="section">
        <h3>Add Joinable Relation</h3>
        <p class="hint">
          Define which containers can be joined together in queries.
        </p>
        <div class="form-row">
          <select bind:value={joinableContainer1}>
            <option value="">Container 1...</option>
            {#each $containers.filter((c) => !c.parentId) as container}
              <option value={container.id}>{container.name}</option>
            {/each}
          </select>
          <span class="join-symbol">⋈</span>
          <select bind:value={joinableContainer2}>
            <option value="">Container 2...</option>
            {#each $containers.filter((c) => !c.parentId) as container}
              <option value={container.id}>{container.name}</option>
            {/each}
          </select>
        </div>
        <button class="btn primary" onclick={handleAddJoinable}>
          Add Joinable
        </button>
      </section>

      <section class="section">
        <h3>Joinable Relations ({$joinableRelations.length})</h3>
        <div class="list">
          {#each $joinableRelations as relation}
            {@const c1 = $containers.find((c) => c.id === relation.container1Id)}
            {@const c2 = $containers.find((c) => c.id === relation.container2Id)}
            <div class="list-item relation">
              <span class="name">{c1?.name ?? "?"}</span>
              <span class="join-symbol">⋈</span>
              <span class="name">{c2?.name ?? "?"}</span>
              <button
                class="btn-icon danger"
                onclick={() =>
                  removeJoinableRelation(
                    relation.container1Id,
                    relation.container2Id
                  )}
                title="Remove"
              >
                ×
              </button>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  </div>

  <div class="footer">
    <button class="btn" onclick={handleExport}>Export</button>
    <button class="btn" onclick={handleImport}>Import</button>
  </div>
</aside>

<style>
  .sidebar {
    width: 300px;
    background: white;
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .tab {
    flex: 1;
    padding: 10px 8px;
    font-size: 12px;
    font-weight: 500;
    color: #718096;
    background: none;
    border: none;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tab:hover {
    background: #f7fafc;
    color: #4a5568;
  }

  .tab.active {
    color: #4299e1;
    border-bottom: 2px solid #4299e1;
    margin-bottom: -1px;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .section {
    margin-bottom: 20px;
  }

  .section h3 {
    font-size: 12px;
    font-weight: 600;
    color: #4a5568;
    margin: 0 0 10px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .hint {
    font-size: 11px;
    color: #a0aec0;
    margin: 0 0 10px 0;
  }

  .form-group {
    margin-bottom: 8px;
  }

  .form-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }

  input[type="text"],
  select {
    flex: 1;
    padding: 8px 10px;
    font-size: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    background: white;
  }

  input[type="text"]:focus,
  select:focus {
    outline: none;
    border-color: #4299e1;
    box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.2);
  }

  input[type="color"] {
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    cursor: pointer;
  }

  .color-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #718096;
  }

  .btn {
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 500;
    color: #4a5568;
    background: #edf2f7;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn:hover {
    background: #e2e8f0;
  }

  .btn.primary {
    color: white;
    background: #4299e1;
  }

  .btn.primary:hover {
    background: #3182ce;
  }

  .btn-icon {
    width: 20px;
    height: 20px;
    padding: 0;
    font-size: 14px;
    line-height: 1;
    color: #a0aec0;
    background: none;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-icon:hover {
    background: #fed7d7;
    color: #c53030;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .list-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: #f7fafc;
    border-radius: 4px;
    font-size: 12px;
  }

  .list-item.indent {
    margin-left: 20px;
    background: #edf2f7;
  }

  .list-item.relation {
    justify-content: flex-start;
  }

  .list-item .icon {
    font-size: 12px;
  }

  .list-item .name {
    flex: 1;
    color: #2d3748;
    font-weight: 500;
  }

  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .scope-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .scope-info .description {
    font-size: 10px;
    color: #a0aec0;
    font-style: italic;
  }

  .join-symbol {
    font-size: 14px;
    color: #9f7aea;
    font-weight: 600;
  }

  .footer {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .footer .btn {
    flex: 1;
  }
</style>
