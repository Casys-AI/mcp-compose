# host

Host integration layer — rendering dashboards and serving them to users.

## API

- `renderComposite(descriptor)` — generate a self-contained HTML5 document from a composite descriptor
- `serveDashboard(html, options)` — serve composed HTML on localhost with auto-open browser
- `CompositeUiHost` — interface for custom host implementations (mount/unmount)
- `HostConfig` — configuration options (sandbox, allowed origins, limits)

## Submodules

- `renderer/` — HTML/CSS/JS generation with event bus (supports preset + areas layouts)
- `serve.ts` — local dashboard server (`Deno.serve` wrapper)

## Design

The host layer handles presentation. The renderer generates HTML from descriptors
(pure function). The server serves it locally (I/O). Custom host implementations
(IDE panels, Electron windows) implement the `CompositeUiHost` interface.
