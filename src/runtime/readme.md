# runtime

Dashboard composition from manifests, templates, and live MCP servers.

This is the only layer with I/O — process management, file reads, HTTP calls.
All composition logic is delegated to `core/`.

## API

- `composeDashboard(request)` — full pipeline: validate → start → call → compose → render → stop
- `composeDashboardFromFiles(manifestDir, templatePath, args)` — convenience file loader
- `createCluster(manifests, serverNames)` — manage MCP server connections
- `startServer(manifest)` — start a child process, detect HTTP port, connect
- `connectHttp(manifest)` — connect to an already-running server
- `parseManifest(json)` / `loadManifests(dir)` — manifest parsing
- `parseTemplate(yaml)` / `loadTemplate(path)` — template parsing
- `injectArgs(calls, args)` — `{{placeholder}}` replacement
- `validateTemplate(template, manifests)` — cross-reference validation

## Transport

Two modes, both using HTTP for tool calls:

| Mode | Process management | Tool calls | UI serving |
|------|-------------------|------------|------------|
| **stdio** | Cluster starts the process with `--http --port=0` | HTTP fetch | Same HTTP URL |
| **http** | Already running (no-op) | HTTP fetch | Same HTTP URL |

## AX Design

- **Structured errors**: Every failure produces a `RuntimeError` with a machine-readable `RuntimeErrorCode`.
- **Guaranteed cleanup**: `stopAll()` runs in `finally` — leaked processes are prevented.
- **Non-fatal warnings**: Tool calls that fail or return no UI are collected as warnings, not thrown.
- **URI resolution**: `ui://server/path` is resolved to `${uiBaseUrl}/ui?uri=...` automatically.
- **No retry**: The runtime does not retry. Callers (agents) decide retry policy.
- **Timeout-aware**: Server startup and tool calls have configurable timeouts.
