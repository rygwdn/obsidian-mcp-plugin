# E2E Test Coverage Expansion Plan

## Current State

### Existing E2E Coverage
- **Authentication**: Token validation (valid/invalid/missing)
- **Core Tools**: `get_contents`, `search`, `update_content`, `get_file_metadata`
- **Resources**: File resources (`file:///`), daily note resources (`daily:///`)
- **Prompts**: List and get with arguments
- **UI**: Settings modal navigation

### Missing E2E Coverage
1. **Dataview Integration** - `dataview_query` tool
2. **QuickAdd Integration** - `quickadd_list`, `quickadd_execute` tools
3. **TaskNotes Integration** - `tasknotes_query`, `tasknotes_update`, `tasknotes_create` tools, stats resource
4. **Daily Notes** - Creating and reading actual daily notes (currently fails because folder doesn't exist)

### Test Vault Limitations
- Only `obsidian-mcp-plugin` is installed
- No Dataview, QuickAdd, or TaskNotes plugins
- Minimal test data (2 notes)
- No daily notes folder pre-created

---

## Phase 1: Expand Test Vault Data

### 1.1 Create Richer Note Structure

```
e2e/test-vault/
├── notes/
│   ├── welcome.md              # Existing
│   ├── project-alpha.md        # Existing (enhance with more metadata)
│   ├── project-beta.md         # New - for search/filter testing
│   ├── meeting-notes.md        # New - for date-based queries
│   └── reference.md            # New - for linking tests
├── daily/                      # New folder for daily notes
│   └── .gitkeep
├── tasks/                      # New folder for TaskNotes testing
│   ├── work-tasks.md
│   └── personal-tasks.md
├── templates/                  # New folder for QuickAdd templates
│   └── daily-template.md
└── prompts/
    └── example-prompt.md       # Existing
```

### 1.2 Enhance Existing Notes

**project-alpha.md** - Add Dataview-queryable fields:
```markdown
---
tags:
  - project
  - active
status: in-progress
priority: high
due: 2024-12-31
created: 2024-01-15
---
```

### 1.3 New Test Notes

**project-beta.md**:
```markdown
---
tags:
  - project
  - archived
status: completed
priority: low
due: 2024-06-30
created: 2024-02-01
---
# Project Beta
Completed project for testing filters.
```

**meeting-notes.md**:
```markdown
---
tags:
  - meeting
  - weekly
date: 2024-12-01
attendees:
  - Alice
  - Bob
---
# Weekly Sync
Discussion points and action items.
```

---

## Phase 2: Add Community Plugins to Test Vault

### 2.1 Plugin Installation Strategy

**Option A: Bundle Plugin Releases (Recommended)**
- Download release artifacts for each plugin
- Store in `e2e/plugins/` directory
- Copy during Docker build

**Option B: Mock Plugin APIs**
- Create minimal mock implementations
- Less accurate but simpler

### 2.2 Plugins to Add

#### Dataview (obsidian-dataview)
- **Source**: https://github.com/blacksmithgu/obsidian-dataview/releases
- **Files needed**: `main.js`, `manifest.json`, `styles.css`
- **Config**: Enable in `community-plugins.json`

#### QuickAdd (quickadd-obsidian)
- **Source**: https://github.com/chhoumann/quickadd/releases
- **Files needed**: `main.js`, `manifest.json`
- **Config**: Create choices in `data.json`

#### TaskNotes (NOT a real plugin - internal mock needed)
- TaskNotes appears to be a custom/internal integration
- Need to verify if it's a real community plugin or requires mocking
- If mock: Create stub that returns test data

### 2.3 Update community-plugins.json

```json
[
  "obsidian-mcp-plugin",
  "dataview",
  "quickadd"
]
```

### 2.4 Plugin Data Configuration

**Dataview** (`plugins/dataview/data.json`):
```json
{
  "renderNullAs": "\\-",
  "taskCompletionTracking": true,
  "warnOnEmptyResult": true
}
```

**QuickAdd** (`plugins/quickadd/data.json`):
```json
{
  "choices": [
    {
      "id": "test-choice-1",
      "name": "Test Template",
      "type": "Template",
      "command": false,
      "templatePath": "templates/daily-template.md"
    },
    {
      "id": "test-choice-2",
      "name": "Test Capture",
      "type": "Capture",
      "command": false,
      "captureTo": "notes/capture.md"
    }
  ]
}
```

---

## Phase 3: New E2E Test Files

### 3.1 Dataview Tests (`e2e/tests/dataview.test.ts`)

```typescript
test.describe("Dataview Integration", () => {
  test("should list dataview_query tool when plugin available", async () => {
    const tools = await client.listTools();
    expect(tools.tools.map(t => t.name)).toContain("dataview_query");
  });

  test("should execute LIST query", async () => {
    const result = await client.callTool({
      name: "dataview_query",
      arguments: {
        query: "LIST FROM #project"
      }
    });
    expect(getToolResultText(result)).toContain("project-alpha");
  });

  test("should execute TABLE query with fields", async () => {
    const result = await client.callTool({
      name: "dataview_query",
      arguments: {
        query: "TABLE status, priority FROM #project"
      }
    });
    expect(getToolResultText(result)).toContain("in-progress");
  });

  test("should handle invalid query gracefully", async () => {
    const result = await client.callTool({
      name: "dataview_query",
      arguments: {
        query: "INVALID SYNTAX HERE"
      }
    });
    expect(result.isError).toBe(true);
  });
});
```

### 3.2 QuickAdd Tests (`e2e/tests/quickadd.test.ts`)

```typescript
test.describe("QuickAdd Integration", () => {
  test("should list quickadd tools when plugin available", async () => {
    const tools = await client.listTools();
    const toolNames = tools.tools.map(t => t.name);
    expect(toolNames).toContain("quickadd_list");
    expect(toolNames).toContain("quickadd_execute");
  });

  test("should list available choices", async () => {
    const result = await client.callTool({
      name: "quickadd_list",
      arguments: {}
    });
    expect(getToolResultText(result)).toContain("Test Template");
  });

  test("should execute choice by name", async () => {
    const result = await client.callTool({
      name: "quickadd_execute",
      arguments: {
        choice: "Test Capture",
        variables: { content: "Test content" }
      }
    });
    expect(result.isError).toBeFalsy();
  });
});
```

### 3.3 TaskNotes Tests (`e2e/tests/tasknotes.test.ts`)

```typescript
test.describe("TaskNotes Integration", () => {
  // Only run if TaskNotes plugin is available
  test("should list tasknotes tools when plugin available", async () => {
    const tools = await client.listTools();
    const toolNames = tools.tools.map(t => t.name);
    // Check if TaskNotes tools are present
    if (toolNames.includes("tasknotes_query")) {
      expect(toolNames).toContain("tasknotes_update");
      expect(toolNames).toContain("tasknotes_create");
    }
  });

  test("should query tasks", async () => {
    const result = await client.callTool({
      name: "tasknotes_query",
      arguments: {
        status: "incomplete"
      }
    });
    // Validate response structure
  });

  test("should read stats resource", async () => {
    const result = await client.readResource({
      uri: "tasknotes:///stats"
    });
    // Validate stats structure
  });
});
```

### 3.4 Enhanced Core Tests (`e2e/tests/mcp-api.test.ts`)

Add to existing file:

```typescript
test.describe("Daily Notes", () => {
  test("should create daily note via update_content", async () => {
    const today = new Date().toISOString().split('T')[0];
    const result = await client.callTool({
      name: "update_content",
      arguments: {
        uri: `daily:///today`,
        mode: "append",
        content: "# Daily Note\n\nCreated by e2e test"
      }
    });
    expect(result.isError).toBeFalsy();
  });

  test("should read created daily note", async () => {
    const result = await client.readResource({
      uri: "daily:///today"
    });
    expect(result.contents[0].text).toContain("Daily Note");
  });
});

test.describe("Search Edge Cases", () => {
  test("should search with tag filter", async () => {
    const result = await client.callTool({
      name: "search",
      arguments: {
        query: "project",
        tags: ["active"]
      }
    });
    expect(getToolResultText(result)).toContain("project-alpha");
    expect(getToolResultText(result)).not.toContain("project-beta");
  });

  test("should search in specific folder", async () => {
    const result = await client.callTool({
      name: "search",
      arguments: {
        query: "test",
        folder: "notes"
      }
    });
    expect(result.isError).toBeFalsy();
  });
});

test.describe("File Metadata", () => {
  test("should return frontmatter in metadata", async () => {
    const result = await client.callTool({
      name: "get_file_metadata",
      arguments: {
        path: "file:///notes/project-alpha.md"
      }
    });
    const text = getToolResultText(result);
    expect(text).toContain("status");
    expect(text).toContain("in-progress");
  });
});
```

---

## Phase 4: Docker Build Updates

### 4.1 Update Dockerfile

Add plugin download step:

```dockerfile
# Download community plugins for testing
COPY e2e/scripts/download-plugins.sh /tmp/
RUN E2E_DIR=/app/e2e bash /tmp/download-plugins.sh
```

### 4.2 Create download-plugins.sh

```bash
#!/bin/bash
set -e

PLUGINS_DIR="${E2E_DIR}/test-vault/.obsidian/plugins"

# Download Dataview
DATAVIEW_VERSION="0.5.67"
mkdir -p "$PLUGINS_DIR/dataview"
curl -L "https://github.com/blacksmithgu/obsidian-dataview/releases/download/${DATAVIEW_VERSION}/main.js" \
  -o "$PLUGINS_DIR/dataview/main.js"
curl -L "https://github.com/blacksmithgu/obsidian-dataview/releases/download/${DATAVIEW_VERSION}/manifest.json" \
  -o "$PLUGINS_DIR/dataview/manifest.json"
curl -L "https://github.com/blacksmithgu/obsidian-dataview/releases/download/${DATAVIEW_VERSION}/styles.css" \
  -o "$PLUGINS_DIR/dataview/styles.css"

# Download QuickAdd
QUICKADD_VERSION="1.11.1"
mkdir -p "$PLUGINS_DIR/quickadd"
curl -L "https://github.com/chhoumann/quickadd/releases/download/${QUICKADD_VERSION}/main.js" \
  -o "$PLUGINS_DIR/quickadd/main.js"
curl -L "https://github.com/chhoumann/quickadd/releases/download/${QUICKADD_VERSION}/manifest.json" \
  -o "$PLUGINS_DIR/quickadd/manifest.json"

echo "Plugins downloaded successfully"
```

### 4.3 Update global-setup.ts

Configure plugin settings in test setup:

```typescript
// Enable additional plugins
const communityPlugins = ["obsidian-mcp-plugin", "dataview", "quickadd"];
fs.writeFileSync(
  path.join(vaultPath, ".obsidian/community-plugins.json"),
  JSON.stringify(communityPlugins)
);

// Configure Dataview
const dataviewConfig = { renderNullAs: "\\-", taskCompletionTracking: true };
fs.writeFileSync(
  path.join(pluginsPath, "dataview/data.json"),
  JSON.stringify(dataviewConfig)
);
```

---

## Phase 5: Test Organization

### 5.1 Final Test Structure

```
e2e/tests/
├── setup.test.ts           # Initial setup (existing)
├── mcp-api.test.ts         # Core MCP API tests (enhanced)
├── ui-settings.test.ts     # UI tests (existing)
├── dataview.test.ts        # NEW: Dataview integration
├── quickadd.test.ts        # NEW: QuickAdd integration
└── tasknotes.test.ts       # NEW: TaskNotes integration (if applicable)
```

### 5.2 Playwright Config Updates

Add test dependencies:

```typescript
projects: [
  { name: "setup", testMatch: /setup\.test\.ts/ },
  {
    name: "core",
    testMatch: /mcp-api\.test\.ts|ui-settings\.test\.ts/,
    dependencies: ["setup"]
  },
  {
    name: "plugins",
    testMatch: /dataview\.test\.ts|quickadd\.test\.ts|tasknotes\.test\.ts/,
    dependencies: ["setup"]
  }
]
```

---

## Implementation Order

1. **Phase 1** - Expand test vault data (low risk, immediate value)
2. **Phase 4.2** - Create plugin download script
3. **Phase 4.1** - Update Dockerfile
4. **Phase 2** - Configure plugins in test vault
5. **Phase 3.4** - Enhance existing core tests
6. **Phase 3.1** - Add Dataview tests
7. **Phase 3.2** - Add QuickAdd tests
8. **Phase 3.3** - Add TaskNotes tests (pending plugin availability verification)
9. **Phase 5** - Reorganize and optimize test config

---

## Open Questions

1. **TaskNotes Plugin**: Is this a real community plugin or an internal/custom integration? Need to verify source.

2. **Plugin Versions**: Should we pin specific versions or use latest? Pinning is more stable but requires maintenance.

3. **CI/CD Impact**: Plugin downloads in Docker build will increase build time. Consider caching strategy.

4. **Test Isolation**: Should plugin tests be skipped gracefully if plugins fail to load, or should they fail hard?
