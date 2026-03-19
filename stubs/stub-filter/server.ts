/**
 * Stub MCP: Filter controls panel.
 * Emits "filter.changed" when user changes filter values.
 *
 * @module stubs/stub-filter
 */

import { ConcurrentMCPServer } from "@casys/mcp-server";
import { buildStubHtml, MCP_APP_MIME_TYPE } from "../shared.ts";

const CATEGORIES = ["all", "widgets", "gadgets", "tools"];

const server = new ConcurrentMCPServer({
  name: "stub-filter",
  version: "0.1.0",
  logger: (msg: string) => console.error(`[stub-filter] ${msg}`),
});

server.registerTool(
  {
    name: "show_filters",
    description: "Show filter controls",
    inputSchema: { type: "object", properties: {} },
    _meta: {
      ui: {
        resourceUri: "ui://stub-filter/filter-panel",
        emits: ["filter.changed"],
      },
    },
  },
  () => ({ categories: CATEGORIES }),
);

server.registerResource(
  {
    uri: "ui://stub-filter/filter-panel",
    name: "Filter Panel",
    description: "MCP App: filter controls",
    mimeType: MCP_APP_MIME_TYPE,
  },
  () => ({
    uri: "ui://stub-filter/filter-panel",
    mimeType: MCP_APP_MIME_TYPE,
    text: buildStubHtml("Filter Panel", `
      <h3>Filters</h3>
      <label>Category</label>
      <select id="category">
        ${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("")}
      </select>
      <br><br>
      <label>Search</label>
      <input id="search" type="text" placeholder="Search...">
    `, `
      var events = composeEvents();
      var cat = document.getElementById("category");
      var search = document.getElementById("search");
      function emitFilter() {
        events.emit("filter.changed", { category: cat.value, search: search.value });
      }
      cat.addEventListener("change", emitFilter);
      search.addEventListener("input", emitFilter);
    `),
  }),
);

// Start
const args = Deno.args;
const httpFlag = args.includes("--http");
const portArg = args.find((a) => a.startsWith("--port="));
const port = portArg ? parseInt(portArg.split("=")[1], 10) : 3020;

if (httpFlag) {
  await server.startHttp({
    port,
    cors: true,
    customRoutes: [{
      method: "get" as const,
      path: "/ui",
      handler: async (req: Request) => {
        const url = new URL(req.url);
        const uri = url.searchParams.get("uri");
        if (!uri) return new Response("Missing uri", { status: 400 });
        const content = await server.readResourceContent(uri);
        if (!content) return new Response("Not found", { status: 404 });
        return new Response(content.text, { headers: { "Content-Type": "text/html" } });
      },
    }],
    onListen: (info: { hostname: string; port: number }) => {
      console.error(`[stub-filter] HTTP server listening on http://${info.hostname}:${info.port}`);
    },
  });
} else {
  await server.start();
}
