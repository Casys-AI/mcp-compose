# deploy

Cloud deployment layer — publish dashboards as shareable links on Deno Deploy.

## Vision

`mcp-compose deploy` takes a local dashboard composition and publishes it online:
- Deploys a **relay worker** on Deno Deploy (one per dashboard, ephemeral)
- Cloud-native MCPs (SaaS APIs) are deployed alongside via the Deploy API
- Local-data MCPs connect via a **WebSocket tunnel** from the local SDK
- The user gets a **shareable URL** — the relay serves the dashboard and routes
  tool calls to the right MCPs (cloud or local via tunnel)
- On teardown, all Deploy resources are deleted programmatically

## Architecture

```
mcp-compose deploy template.yaml
  │
  ├─ Cloud-native MCPs (no local data needed)
  │   → Deploy API: create project + deployment with env vars
  │   → MCP runs on xxx.deno.dev
  │
  ├─ Local-data MCPs (DB, Docker, local files)
  │   → SDK starts MCP locally
  │   → SDK opens outbound WebSocket to relay
  │   → Relay routes tool calls through tunnel
  │
  └─ Relay worker (one per dashboard)
      → Serves dashboard HTML on a public URL
      → Routes tool calls to cloud MCPs (HTTP) or local MCPs (WebSocket)
      → Session-based routing (one session per deploy)
      → Deleted on teardown

User gets: https://relay-xxx.deno.dev → shareable link
```

## Planned API

- `deployDashboard(request)` — deploy relay + MCPs, return shareable URL
- `teardownDashboard(deploymentId)` — delete all Deploy resources
- `createTunnel(relayUrl, localCluster)` — connect local MCPs to relay via WebSocket

## Transport types

Extends the existing `McpTransport` with a new `"deploy"` type:

```typescript
interface DeployTransport {
  type: "deploy";
  /** JSR package to deploy (e.g., "jsr:@casys/mcp-einvoice"). */
  package: string;
  /** Args for the deployed server. */
  args?: string[];
}
```

The manifest can then declare:
```json
{
  "name": "mcp-einvoice",
  "transport": { "type": "deploy", "package": "jsr:@casys/mcp-einvoice" },
  "requiredEnv": ["IOPOLE_CLIENT_ID", "IOPOLE_CLIENT_SECRET"],
  "tools": [...]
}
```

## Dependencies

- Deno Deploy REST API (`https://api.deno.com/v1/`)
- `DENO_DEPLOY_TOKEN` for authentication
- Organization ID for project creation
- `runtime/` for composing the dashboard before deploying
- `core/` for types

## Design

- Deploy is opt-in — local composition works without it
- Ephemeral by default — resources are cleaned up on teardown
- One relay per dashboard (not shared) — isolates sessions
- Local tunnel is outbound-only (no port forwarding, firewall-friendly)
- Env vars are stored in Deploy (protected), never in the dashboard HTML
