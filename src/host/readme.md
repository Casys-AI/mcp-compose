# host

Host integration layer for mcp-compose.

## Purpose

Defines the contracts a host application must satisfy to embed composite UIs.
This is a **type-only** module — no runtime code, no dependencies beyond core types.

## Types

- `CompositeUiHost` — interface for mounting/unmounting composite UIs
- `HostConfig` — configuration options (sandbox, allowed origins, limits)

## Design

The host layer is intentionally thin. It provides the type surface for
host implementations without prescribing a specific runtime. Actual
host implementations live outside this library.
