# mcp-compose — MCP Apps UI Orchestrator

## Vision

Lightweight Deno library for composing and synchronizing multiple MCP Apps UIs into composite
dashboards. The missing layer between isolated MCP server UIs.

**Core value proposition:** "Your MCP servers already have UIs. mcp-compose makes them talk to each
other."

## What This Is

A standalone, dependency-free library that:

1. **Collects** UI resources from MCP tool responses (`_meta.ui.resourceUri`)
2. **Composes** them into layouts (split, tabs, grid, stack)
3. **Synchronizes** cross-UI events via declarative sync rules
4. **Generates** self-contained HTML dashboards with an event bus

## What This Is NOT

- Not a gateway or proxy
- Not a tracing/observability system
- Not an auth layer
- Not an MCP client (bring your own)
- Not PML (no procedural memory, no learning, no capability loading)

## Product Boundary

This spec describes the composition primitive.
It does not define a no-code or end-user dashboard builder.
Orchestration authoring is assumed to happen upstream in developer, agent, or product-layer code.

## Architecture

```
┌─────────────────────────────────────────────┐
│              mcp-compose                     │
│                                              │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  │
│  │ Collector │→ │ Composer  │→ │ Renderer │  │
│  │           │  │           │  │          │  │
│  │ Inspects  │  │ Builds    │  │ Outputs  │  │
│  │ _meta.ui  │  │ composite │  │ HTML +   │  │
│  │ from MCP  │  │ descriptor│  │ EventBus │  │
│  │ responses │  │ + sync    │  │          │  │
│  └──────────┘  └───────────┘  └──────────┘  │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │         Declarative Sync Rules       │    │
│  │  { from, event, to, action }         │    │
│  │  Cross-UI event routing via          │    │
│  │  postMessage (JSON-RPC 2.0)          │    │
│  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## Modules

### 1. `core/` — Composition semantics

`core` is the source of truth for the composition model.
It owns:

- `types/` — `UiLayout`, `UiSyncRule`, `UiOrchestration`, resource and descriptor types
- `collector/` — extraction and accumulation of `_meta.ui.resourceUri`
- `sync/` — sync rule validation and resolution
- `composer/` — `buildCompositeUi(...)`
- `renderer/` — HTML and event-bus generation

This layer stays deterministic, side-effect free, and dependency-free.

### 2. `sdk/` — External shape adapters

`sdk` owns adaptation only:

- `createMcpSdkCollector()` for SDK-shaped `CallToolResult` values
- `uiMeta()` for typed `_meta.ui` construction
- `validateComposition()` for tool-definition-level semantic checks

`sdk` does not own composition semantics or rendering logic.

### 3. `host/` — Host integration contracts

`host` defines the host-facing contracts for embedding composite UIs.
It stays intentionally thin and type-oriented.

## AX (Agent Experience) Design Principles

This library is designed to be used BY agents, not just humans:

1. **Fast fail early**: Invalid sync rules, bad resource URIs → immediate clear errors, not runtime
   surprises.
2. **Deterministic outputs**: Same inputs → same outputs. No hidden heuristics.
3. **Machine-readable errors**: Structured error objects with codes, not just string messages.
4. **Explicit over implicit**: No magic defaults that change behavior. Everything is declared.
5. **Composable primitives**: Each function does one thing. Collector → Composer → Renderer. Agents
   can use each step independently.
6. **Documentation co-located**: Each module has its own README with I/O contract.
7. **Test-first invariants**: Every sync rule behavior has a test.
8. **Narrow contracts**: Minimal required inputs, maximal type safety.

## File Structure

```
lib/mcp-compose/
├── deno.json              # Deno config, tasks, exports
├── mod.ts                 # Main entry point (re-exports)
├── SPEC.md                # This file
├── PRD.md                 # Product boundary and ownership
├── README.md              # Usage docs
├── src/
│   ├── core/
│   │   ├── types/
│   │   ├── collector/
│   │   ├── sync/
│   │   ├── composer/
│   │   └── renderer/
│   ├── sdk/
│   │   ├── mcp-sdk.ts
│   │   ├── ui-meta-builder.ts
│   │   └── composition-validator.ts
│   ├── host/
│   │   └── types.ts
│   ├── architecture_test.ts
│   ├── edge-cases_test.ts
│   ├── full-pipeline_test.ts
│   └── test-fixtures/
└── docs/
    ├── plans/
    └── decision-records/
```

## Dependencies

**Zero runtime dependencies.** Deno standard library only where needed. No npm packages, no external
frameworks.

## MCP Apps Protocol Compliance

The event bus implements:

- `ui/initialize` — handshake with host capabilities
- `ui/update-model-context` — context sharing between UIs
- `ui/notifications/tool-result` — forwarding results to target UIs
- `ui/message` — logging/debugging channel

All messages follow JSON-RPC 2.0.

## Current Status

Implemented today:

- canonical `core / sdk / host` structure
- collector, sync, composer, and renderer pipeline
- MCP SDK adaptation helpers
- host contracts
- test suite with cross-slice pipeline coverage
- JSR sync/publish automation

Future work remains possible, but it should stay within the primitive/product boundary above.

## Future Work

- [ ] Bidirectional sync rules
- [ ] Conditional sync (event data matching)
- [ ] Sync rule composition (chains)
- [ ] Dashboard persistence (save/load descriptors)

## Source Reference

Extracted and improved from `packages/pml/src/ui/composite-generator.ts` and
`packages/pml/src/types/ui-orchestration.ts`. The PML versions remain unchanged — this is a clean
extraction with improvements.
