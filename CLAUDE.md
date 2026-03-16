# CLAUDE.md — Agent Instructions for mcp-compose

## Project Overview

mcp-compose is a standalone Deno library for composing and synchronizing multiple MCP Apps UIs into
composite dashboards.

Read `SPEC.md` for the full specification. This file provides build context.

## Reference Code

The `_reference/` directory contains the original PML code this lib is extracted from:

- `pml-composite-generator.ts` — the original composite UI builder
- `pml-ui-orchestration-types.ts` — the original type definitions
- `pml-composite-generator_test.ts` — existing tests

**DO NOT copy-paste.** Use as reference for understanding the domain. Rewrite everything from
scratch following the SPEC.md architecture.

## Constraints

1. **Zero dependencies.** No npm packages. Deno standard library only.
2. **Pure functions.** No I/O, no network, no filesystem in core modules. The `sdk/` layer may
   adapt external result shapes, but it must not own composition semantics.
3. **Test-first.** Write tests before implementation for each module.
4. **AX principles.** Machine-readable errors, deterministic outputs, explicit defaults, composable
   primitives.
5. **Deno conventions.** Use `mod.ts` for module exports. Use `_test.ts` suffix for test files
   co-located with source.
6. **Product boundary.** The library consumes explicit orchestration. Intent-first or end-user
   dashboard authoring belongs in a higher layer, not in `src/`.

## Build & Test

```bash
deno task test      # Run all tests
deno task check     # Type check
deno task lint      # Lint
deno task fmt       # Format
```

## Module Order (implement in this order)

1. `src/core/types/` — All type definitions first
2. `src/core/sync/` — Sync rule resolver and validator
3. `src/core/collector/` — UI resource collector
4. `src/core/composer/` — Composite UI builder
5. `src/core/renderer/` — HTML generator with event bus
6. `src/sdk/` — External shape adapters and helpers
7. `src/host/` — Host contracts only
8. `mod.ts` — Public API exports
9. `src/*_test.ts` — Cross-slice pipeline tests
10. `README.md` / `SPEC.md` — Usage and boundary documentation

## Type Design

Keep types in `src/core/types/` by domain concern:

- `layout.ts` — UiLayout type
- `sync-rules.ts` — UiSyncRule, ResolvedSyncRule
- `orchestration.ts` — UiOrchestration (combines layout + sync + sharedContext)
- `resources.ts` — CollectedUiResource
- `descriptor.ts` — CompositeUiDescriptor
- `mcp-apps.ts` — MCP Apps spec types (SEP-1865)

## Event Bus Protocol

The rendered HTML includes a JavaScript event bus that implements:

- JSON-RPC 2.0 messages via postMessage
- `ui/initialize` handshake
- `ui/update-model-context` for sync rule routing
- `ui/notifications/tool-result` for forwarding to targets
- Broadcast support via `to: "*"`

## Quality Bar

- All public functions must have JSDoc with @example
- All sync rule behaviors must have tests
- All error paths must return structured errors (not thrown strings)
- Generated HTML must be valid HTML5
- Event bus must handle malformed messages gracefully
