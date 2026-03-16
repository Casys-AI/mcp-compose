# sdk contract

## Inputs

- MCP SDK `CallToolResult` objects (structural typing)
- `UiMetaOptions` for `uiMeta()` builder
- Tool definitions with `_meta.ui` + `UiSyncRule[]` for `validateComposition()`

## Outputs

- `CollectedUiResource[]` via core collector delegation
- `UiMetaResult` (`{ _meta: { ui } }`) from `uiMeta()`
- `CompositionValidationResult` from `validateComposition()`

## Invariants

- SDK adapters only normalize external result shapes.
- SDK adapters must not own composition or rendering logic.
- `validateComposition()` delegates structural checks to core `validateSyncRules`.
- Semantic checks (emits/accepts) only fire when tools declare them.
- Depends only on core — no circular deps to host or other layers.
