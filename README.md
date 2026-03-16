# mcp-compose

Lightweight Deno library for composing and synchronizing multiple MCP Apps UIs into composite
dashboards.

**Your MCP servers already have UIs. mcp-compose makes them talk to each other.**

## Positioning

`mcp-compose` is a composition primitive for developers, integrators, and agents.
It consumes explicit orchestration plus MCP tool results and renders a composite UI.
It does not provide an end-user or no-code dashboard builder; intent-first authoring belongs in a
higher product layer built on top of this library.

## Why mcp-compose?

MCP Apps (SEP-1865) let each MCP server expose its own UI via `_meta.ui.resourceUri`. But when an
agent calls 3 tools and gets 3 separate UIs, they sit in isolation — no shared state, no event
routing, no coordinated layout.

**mcp-compose** bridges that gap:

| Without mcp-compose                        | With mcp-compose                             |
| ------------------------------------------ | -------------------------------------------- |
| 3 separate iframes, no communication       | Single dashboard with layout + event routing |
| Manual postMessage wiring per tool pair    | Declarative sync rules (`from/event/to`)     |
| Each UI builds its own host handshake      | Automatic MCP Apps protocol compliance       |
| Agent must manually track UI relationships | Pipeline: collect -> compose -> render       |

**For agents:** the pipeline is three pure function calls with zero ambient knowledge required.
**For integrators:** you can render a working composite dashboard without hand-writing host HTML or
`postMessage` plumbing.

## Install

```typescript
import { buildCompositeUi, createCollector, renderComposite } from "jsr:@casys/mcp-compose";
```

## Quick Start

A complete, runnable example — from MCP tool results to rendered HTML:

```typescript
import {
  buildCompositeUi,
  createCollector,
  renderComposite,
  validateSyncRules,
} from "@casys/mcp-compose";

// 1. Collect UI resources from MCP tool results
const collector = createCollector();

// Simulate MCP tool call results with _meta.ui.resourceUri
const pgResult = {
  content: [{ type: "text", text: "Query executed" }],
  _meta: { ui: { resourceUri: "ui://postgres/table/sales-q1" } },
};
const vizResult = {
  content: [{ type: "text", text: "Chart rendered" }],
  _meta: { ui: { resourceUri: "ui://viz/chart/bar-sales" } },
};

collector.collect("postgres:query", pgResult, { query: "SELECT * FROM sales" });
collector.collect("viz:render", vizResult);

const resources = collector.getResources();
// resources.length === 2, slots [0, 1]

// 2. (Optional) Validate sync rules before composing
const orchestration = {
  layout: "split" as const,
  sync: [
    { from: "postgres:query", event: "filter", to: "viz:render", action: "update" },
  ],
  sharedContext: ["query"],
};

const validation = validateSyncRules(
  orchestration.sync,
  resources.map((r) => r.source),
);
// validation.valid === true

// 3. Build a composite descriptor
const descriptor = buildCompositeUi(resources, orchestration);
// descriptor.sync[0] === { from: 0, event: "filter", to: 1, action: "update" }
// descriptor.sharedContext === { query: "SELECT * FROM sales" }

// 4. Render to self-contained HTML
const html = renderComposite(descriptor);
// html is a complete HTML document with layout CSS, event bus JS, and iframes
```

## Pipeline

```
Collector  ->  Composer  ->  Renderer
(collect)     (build)       (render)
```

Each step is a pure function. Use them independently or together.

## Layouts

| Layout  | Description                   |
| ------- | ----------------------------- |
| `split` | Side-by-side panels (flexbox) |
| `tabs`  | Tabbed interface with tab bar |
| `grid`  | Auto-fit grid for dashboards  |
| `stack` | Vertical stack (default)      |

## Sync Rules

Declarative event routing between UIs:

```typescript
const orchestration = {
  layout: "split",
  sync: [
    // When postgres:query emits "filter", update viz:render
    { from: "postgres:query", event: "filter", to: "viz:render", action: "update" },

    // Broadcast to all UIs when date changes
    { from: "date:picker", event: "change", to: "*", action: "refresh" },
  ],
  // Extract and share context across all UIs
  sharedContext: ["workflowId", "userId"],
};
```

## Validation

Validate sync rules before composition:

```typescript
import { validateSyncRules } from "@casys/mcp-compose";

const result = validateSyncRules(
  [{ from: "a", event: "click", to: "unknown", action: "update" }],
  ["a", "b"],
);
// result.valid === false
// result.issues[0].code === "ORPHAN_SYNC_REFERENCE"
```

## Collector API

```typescript
import { createCollector } from "@casys/mcp-compose";

const collector = createCollector();

// Collect from MCP tool results (auto-extracts _meta.ui.resourceUri)
const resource = collector.collect("tool:name", mcpToolResult, optionalContext);
// Returns CollectedUiResource | null

collector.getResources(); // All collected resources in slot order
collector.clear(); // Reset
```

## MCP SDK Adapter

For projects using `@modelcontextprotocol/sdk`:

```typescript
import { createMcpSdkCollector } from "@casys/mcp-compose";

const collector = createMcpSdkCollector();

// Accepts SDK CallToolResult objects directly
// Automatically skips error results (isError: true)
collector.collectFromSdk("postgres:query", sdkCallToolResult, { query: "..." });

// Access the underlying core collector if needed
collector.inner.collect("manual", rawResult);

const resources = collector.getResources();
```

## Event Bus Protocol

The rendered HTML includes a JavaScript event bus implementing:

- **`ui/initialize`** -- Handshake with host capabilities (MCP Apps SEP-1865)
- **`ui/update-model-context`** -- Routes events per sync rules
- **`ui/notifications/tool-result`** -- Forwards data to target UIs
- **`ui/message`** -- Logging/debugging channel

All messages use JSON-RPC 2.0 via `postMessage`.

## Error Codes

| Code                    | Description                            |
| ----------------------- | -------------------------------------- |
| `ORPHAN_SYNC_REFERENCE` | Sync rule references unknown tool name |
| `CIRCULAR_SYNC_RULE`    | Sync rule routes to itself             |
| `INVALID_LAYOUT`        | Invalid layout value                   |
| `MISSING_RESOURCE_URI`  | Missing resourceUri in UI metadata     |
| `NO_UI_METADATA`        | Tool result has no UI metadata         |
| `EMPTY_RESOURCES`       | No resources provided to composer      |

## Development

```bash
deno task test      # Run the full test suite
deno task check     # Type check
deno task lint      # Lint
deno task fmt       # Format
```

See also [PRD.md](./PRD.md) and
[`docs/decision-records/0001-orchestration-authoring-boundary.md`](./docs/decision-records/0001-orchestration-authoring-boundary.md)
for the product boundary.

## Design Principles (AX)

This library follows [AX (Agent Experience)](https://github.com/AXDesignPattern) principles:

- **Zero dependencies** -- Deno standard library only
- **Pure functions** -- No I/O, no network, no filesystem in core
- **Deterministic** -- Same inputs produce same outputs (UUID isolated)
- **Machine-readable errors** -- Structured `ErrorCode` + `ValidationIssue`, not string throws
- **Fail-fast** -- Invalid sync rules rejected upfront, no silent fallbacks
- **Composable primitives** -- Each pipeline step works independently
- **Narrow contracts** -- Functions take minimal inputs, maximal type safety
- **Co-located docs** -- JSDoc + @example on every public export

## License

MIT
