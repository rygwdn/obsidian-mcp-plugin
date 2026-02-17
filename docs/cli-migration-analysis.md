# Obsidian CLI Migration Analysis

Investigation into moving capabilities exposed by this MCP plugin to use the
new Obsidian CLI (v1.12+, released February 10, 2026).

## Background

The Obsidian CLI is a new official command-line interface that ships with
Obsidian 1.12+. It communicates with a running Obsidian desktop instance and
provides 100+ commands spanning file operations, search, tasks, tags,
properties, templates, links, and more. The CLI currently requires an Early
Access Catalyst license ($25 one-time) and the Obsidian app to be running.

This plugin currently runs an MCP server *inside* the Obsidian process via an
HTTP/HTTPS endpoint with Bearer token auth. The question is: can we move some
or all of these capabilities to an external MCP server that shells out to the
`obsidian` CLI instead?

## Capability Mapping

### 1. `get_contents` (file read + directory listing)

| Aspect | MCP Plugin | CLI Equivalent |
|--------|-----------|----------------|
| Read file | `get_contents` with `file:///path` URI | `obsidian read path=<path>` |
| Read daily note | `get_contents` with `daily:///today` | `obsidian daily:read` |
| List directory | `get_contents` with directory URI + depth | `obsidian files folder=<path> ext=md` / `obsidian folders` |
| Byte-offset slicing | `startOffset`/`endOffset` params | **No equivalent** -- CLI returns full file content |

**Migration feasibility**: Mostly feasible. File reading and daily note access
map directly. Directory listing is available via `files` and `folders`
commands. The byte-offset slicing feature has no CLI equivalent; consumers
would need to slice output client-side.

### 2. `get_file_metadata`

| Aspect | MCP Plugin | CLI Equivalent |
|--------|-----------|----------------|
| Frontmatter | Returns parsed frontmatter fields | `obsidian properties path=<path> format=tsv` |
| Tags | Tag names + positions | `obsidian tags` (file scope) or parse frontmatter |
| Headings | Heading text + line/offset positions | `obsidian outline path=<path>` |
| File size/dates | stat info (size, ctime, mtime) | **No direct equivalent** -- would need filesystem stat |
| TaskNotes metadata | Plugin-specific computed fields | **No equivalent** |

**Migration feasibility**: Partial. Frontmatter maps to `properties`, headings
map to `outline`, tags are available. File stat info and TaskNotes metadata
have no CLI counterpart. The CLI returns less structured data (no character
offsets for tags/headings).

### 3. `update_content` (append + find/replace)

| Aspect | MCP Plugin | CLI Equivalent |
|--------|-----------|----------------|
| Append to file | `mode: "append"` | `obsidian append path=<path> content="..."` |
| Append to daily | daily URI + append | `obsidian daily:append content="..."` |
| Find & replace | `mode: "replace"` with `find` param | **No direct equivalent** |
| Create file | `create_if_missing: true` | `obsidian create name=<name> content="..." silent` |
| Prepend | Not supported | `obsidian prepend path=<path> content="..."` (CLI has this extra) |

**Migration feasibility**: Partial. Append and create map well. The
find-and-replace feature (with single-match enforcement) has no CLI
equivalent. The CLI also has a known issue where `create` without `silent`
opens the GUI, and multiline content with special characters can fail
silently. The CLI adds `prepend` which the plugin currently lacks.

### 4. `search`

| Aspect | MCP Plugin | CLI Equivalent |
|--------|-----------|----------------|
| Text search | Full-text with match positions | `obsidian search query="..." format=json matches` |
| Fuzzy search | `fuzzy: true` parameter | **No equivalent** -- CLI has basic text search only |
| Folder scoping | `folder` parameter | `obsidian search query="..." path=<folder>` |
| Result limit | `limit` parameter | `obsidian search query="..." limit=10` |
| Match context | Returns surrounding text (100 chars) | `matches` flag returns line number + text |

**Migration feasibility**: Mostly feasible. The CLI search with
`format=json matches` returns structured results with line-level matches. The
plugin's character-offset positions and fuzzy search have no CLI equivalent.
The CLI returns line-based context rather than character-offset-based context.

### 5. `dataview_query`

| Aspect | MCP Plugin | CLI Equivalent |
|--------|-----------|----------------|
| Dataview queries | Full DQL (LIST/TABLE/TASK) | **No equivalent** |

**Migration feasibility**: Not feasible via CLI. The CLI has no Dataview
integration. Dataview is a community plugin with its own query engine. The
only potential workaround would be `obsidian eval` to execute arbitrary JS
accessing the Dataview API, but this is a security concern (the eval command
is explicitly flagged as dangerous).

Obsidian Bases (`obsidian base:query`) provides some overlapping
functionality for structured note queries, but it is a different system with
different query syntax and capabilities.

### 6. `quickadd_list` / `quickadd_execute`

| Aspect | MCP Plugin | CLI Equivalent |
|--------|-----------|----------------|
| List choices | Returns available QuickAdd choices | **No equivalent** |
| Execute choice | Runs a QuickAdd choice with variables | **No equivalent** |
| Format template | Processes QuickAdd template syntax | **No equivalent** |

**Migration feasibility**: Not feasible via CLI. QuickAdd is a community
plugin; the CLI has no integration with it. The `obsidian templates` commands
handle core/Templater templates, not QuickAdd.

### 7. `tasknotes_query` / `tasknotes`

| Aspect | MCP Plugin | CLI Equivalent |
|--------|-----------|----------------|
| Query tasks (filtered) | Status/priority/date/tag filters | `obsidian tasks all todo` / `obsidian tasks all done` |
| Task stats | Total/active/completed/overdue counts | **No equivalent** |
| Create task | Create with title/status/priority/due | **No equivalent** (would need `create` + property set) |
| Update task | Update any field by path | **No equivalent** (would need property manipulation) |
| Toggle task | N/A | `obsidian task ref="<path>:<line>" toggle` |

**Migration feasibility**: Very limited. The CLI tasks commands operate on
markdown checkboxes, not TaskNotes plugin tasks. TaskNotes has its own data
model with priorities, scheduling, blocking, time tracking, etc. that has no
CLI representation. Basic "list all todos" is available but filtered queries,
stats, and CRUD operations are not.

### 8. `timeblocks_query` / `timeblocks`

| Aspect | MCP Plugin | CLI Equivalent |
|--------|-----------|----------------|
| Query timeblocks | Get blocks for a date | **No equivalent** |
| Create/update/delete | Full CRUD on timeblocks | **No equivalent** |

**Migration feasibility**: Not feasible. Timeblocks are a plugin-specific
feature with no CLI representation.

### 9. MCP Resources (`file://`, `daily://`, `metadata://`)

| Resource | CLI Equivalent |
|----------|---------------|
| `file://` read | `obsidian read path=...` |
| `file://` list | `obsidian files folder=...` |
| `daily://` | `obsidian daily:read` |
| `metadata://` | Partial via `obsidian properties` + `obsidian outline` |

**Migration feasibility**: The MCP resource protocol (list, read, complete)
provides structured access that doesn't map to CLI invocations. An external
MCP server could implement these by calling CLI commands, but would lose
autocompletion and the URI template system would need to be reimplemented.

### 10. MCP Prompts (dynamic templates from vault)

| Aspect | MCP Plugin | CLI Equivalent |
|--------|-----------|----------------|
| List prompts | Scans prompts folder | `obsidian templates` (different system) |
| Read prompt | Returns template with variables | `obsidian template:read name=<name>` |
| Variable substitution | `{{variable}}` replacement | `obsidian template:read name=<name> resolve` |

**Migration feasibility**: Partial. The CLI template system is different
(core/Templater templates vs. custom prompt files). An external server could
read prompt files via `obsidian read` and do variable substitution itself.

### 11. Authentication & Permissions

| Aspect | MCP Plugin | CLI Equivalent |
|--------|-----------|----------------|
| Multiple tokens | Per-client tokens with different permissions | N/A -- CLI runs as the local user |
| Tool-level permissions | Enable/disable individual tools per token | **No equivalent** |
| Directory-level ACLs | Allow/deny per-directory per-token | **No equivalent** |
| File-level overrides | `mcp_access`/`mcp_readonly` frontmatter | **No equivalent** |

**Migration feasibility**: Not feasible. The CLI has no authentication or
permission model -- it operates with full access as the local user. The
plugin's granular permission system is a significant differentiator for
multi-client scenarios.

## Summary Matrix

| Capability | CLI Coverage | Notes |
|-----------|-------------|-------|
| Read files | Full | Direct mapping |
| Read daily notes | Full | `daily:read` |
| List directories | Full | `files`, `folders` |
| Byte-offset slicing | None | No CLI support |
| File metadata | Partial | Properties + outline, but no stat/TaskNotes |
| Append content | Full | Direct mapping |
| Prepend content | Better | CLI has this, plugin doesn't |
| Find & replace | None | No CLI support |
| Create files | Full | `create ... silent` |
| Search (basic) | Full | `search ... format=json matches` |
| Search (fuzzy) | None | No CLI support |
| Dataview queries | None | Different system (Bases) |
| QuickAdd | None | No CLI support |
| TaskNotes | Minimal | CLI tasks are checkbox-based, not plugin-based |
| Timeblocks | None | No CLI support |
| Prompts/templates | Partial | Different template system |
| Auth/permissions | None | CLI has no auth model |
| MCP Resources | N/A | Would need reimplementation |
| MCP Prompts | N/A | Would need reimplementation |

## Architectural Approaches

### Approach A: Thin CLI Wrapper MCP Server

Build a standalone MCP server (Node.js or Python) that wraps CLI commands.

**Pros:**
- No Obsidian plugin needed (simpler installation)
- Benefits from CLI improvements automatically
- Runs as a separate process (doesn't affect Obsidian stability)
- Simpler codebase -- just command construction and output parsing

**Cons:**
- Loses ~50% of current capabilities (Dataview, QuickAdd, TaskNotes, Timeblocks, permissions)
- CLI output parsing is fragile (22.8% silent failure rate documented)
- No structured error handling (exit codes unreliable)
- Process spawning overhead per operation vs. in-process API calls
- Still requires Obsidian running (same as current plugin)
- No authentication/permission model
- Multiline content handling is buggy in CLI

**Verdict**: Only viable as a minimal/starter tool for basic vault operations.
Not a replacement for the current plugin.

### Approach B: Hybrid -- CLI for Basic Ops, Plugin for Advanced

Keep the plugin for capabilities the CLI can't provide, but optionally
delegate basic file/search operations to the CLI.

**Pros:**
- Could reduce plugin complexity for basic operations
- Plugin still handles Dataview, QuickAdd, TaskNotes, Timeblocks, permissions
- CLI delegation could work for users who want simpler setup for basic ops

**Cons:**
- Added complexity of two communication channels
- No clear benefit -- the plugin already handles basic ops efficiently
- Mixed error handling (plugin errors vs. CLI parsing)
- Additional dependency (CLI availability + version compatibility)

**Verdict**: Adds complexity without clear benefit. The plugin already handles
basic operations in-process more reliably than CLI would.

### Approach C: Plugin Stays, CLI Skill for Direct Agent Use

Keep the MCP plugin as-is. Separately, support the official `obsidian-cli`
agent skill for agents that want to use the CLI directly (e.g., Claude Code
with the kepano/obsidian-skills skill).

**Pros:**
- No changes needed to the plugin
- Users choose: MCP plugin for structured access, or CLI skill for ad-hoc
- CLI skill is maintained by Obsidian team (kepano)
- Plugin provides richer, more reliable access for MCP-aware clients

**Cons:**
- Two separate tools for users to understand
- CLI skill and MCP plugin may give different results for same operation

**Verdict**: Most pragmatic approach. The MCP plugin and CLI serve different
use cases and can coexist.

### Approach D: External MCP Server Using `obsidian eval`

Build an external MCP server that uses `obsidian eval code="..."` to execute
arbitrary JavaScript in the Obsidian context, accessing the full internal API.

**Pros:**
- Could theoretically replicate all plugin functionality
- Runs externally but accesses full Obsidian API
- Could access Dataview, QuickAdd, TaskNotes APIs via eval

**Cons:**
- `eval` is explicitly flagged as a safety risk
- Constructing complex JS via command-line arguments is extremely fragile
- No sandboxing or permission controls
- Debugging is difficult
- Command injection risks
- Performance overhead of serializing complex queries as CLI arguments

**Verdict**: Not recommended. Security and reliability concerns make this
impractical.

## Recommendations

1. **Keep the MCP plugin as the primary integration path.** The CLI cannot
   replicate the plugin's advanced capabilities (Dataview, QuickAdd,
   TaskNotes, Timeblocks, granular permissions). The plugin's in-process
   architecture provides more reliable, structured, and performant access.

2. **Consider adding CLI-parity features the plugin currently lacks:**
   - `prepend` mode for `update_content` (CLI has this)
   - `move`/`rename` file operations (CLI has `obsidian move`)
   - `delete` file operations (CLI has `obsidian delete`)
   - `backlinks`/`links` queries (CLI has `obsidian backlinks`, `obsidian links`)
   - `orphans`/`unresolved` link detection (CLI has these)
   - `outline` as a standalone tool (currently only in metadata)
   - Tags listing/counting (CLI has `obsidian tags all counts`)

3. **Document the relationship.** Help users understand when to use the MCP
   plugin vs. the CLI directly. The MCP plugin is better for:
   - Multi-client access with per-token permissions
   - Structured MCP protocol integration
   - Plugin-specific features (Dataview, QuickAdd, TaskNotes, Timeblocks)
   - Reliable, structured responses

   The CLI is better for:
   - Quick ad-hoc vault operations from a terminal
   - Agent use without MCP infrastructure
   - Operations the plugin doesn't expose (move, delete, backlinks, orphans)

4. **Monitor CLI maturity.** The CLI is Early Access (v1.12) with documented
   reliability issues (22.8% silent failure rate). As it matures, the
   calculus may change. Key things to watch:
   - Structured output improvements (`format=json` reliability)
   - Plugin API exposure (could CLI eventually expose Dataview, etc.?)
   - Authentication/permission features
   - Error reporting improvements
   - Headless/remote operation support (currently requires running GUI)

5. **Consider an optional CLI-based transport.** If the CLI eventually supports
   reliable structured I/O, it could serve as an alternative transport for
   the MCP server (instead of HTTP), reducing the need for network
   configuration and token management for single-user setups.
