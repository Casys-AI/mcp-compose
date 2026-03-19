# sdk

MCP SDK adapters — optional convenience wrappers for MCP client SDKs.

## Purpose

Provides three capabilities:

1. **SDK Collector** (`createMcpSdkCollector`) — Wraps the core `UiCollector`
   with an interface that accepts `@modelcontextprotocol/sdk` `CallToolResult`
   objects directly. Error results are automatically skipped.

2. **`uiMeta()` builder** — Typed helper for declaring `_meta.ui` with PML
   extensions (`emits`/`accepts`) on top of standard SEP-1865 fields
   (`resourceUri`, `visibility`, `csp`, `permissions`, `domain`,
   `prefersBorder`). Returns an object ready to spread into a tool definition.

3. **`validateComposition()`** — Takes tool definitions (with `_meta.ui`) and
   sync rules, returns validation issues: orphan emits, orphan accepts,
   mismatched events/actions, and structural issues (delegated to core
   validator).

4. **`composeEvents()`** — UI-side helper for cross-UI event routing.
   Uses a dedicated `ui/compose/event` JSON-RPC method via postMessage,
   separate from the MCP Apps protocol. Works alongside the ext-apps `App`
   class without interfering. Provides `emit()`, `on()`, and `destroy()`.

## Design

- Uses structural typing (no SDK import required).
- Delegates structural validation to core sync validator.
- Zero-dependency: only imports from `../core/`.
- Pure functions, no I/O.
- `composeEvents()` uses its own JSON-RPC method (`ui/compose/event`),
  avoiding conflation with MCP Apps protocol methods.
