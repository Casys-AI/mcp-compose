#!/usr/bin/env -S deno run --allow-all
/**
 * Demo: compose a dashboard from stubs and open it in the browser.
 *
 * Usage:
 *   deno run --allow-all stubs/demo.ts [template]
 *   deno task demo [template]
 *
 * Templates:
 *   master-detail   — list + detail (split)
 *   filter-chart    — filter + chart (split)
 *   full            — all 4 stubs (grid) [default]
 *
 * @module stubs/demo
 */

import { parseManifest } from "../src/runtime/manifest.ts";
import { loadTemplate, validateTemplate, injectArgs } from "../src/runtime/template.ts";
import { createCluster } from "../src/runtime/cluster.ts";
import { createCollector } from "../src/core/collector/collector.ts";
import { buildCompositeUi } from "../src/core/composer/composer.ts";
import { renderComposite } from "../src/host/renderer/html-generator.ts";
import { serveDashboard } from "../src/host/serve.ts";
import type { McpManifest } from "../src/runtime/types.ts";

const STUBS_DIR = new URL("./", import.meta.url).pathname;

const TEMPLATES: Record<string, string> = {
  "master-detail": "templates/master-detail.yaml",
  "filter-chart": "templates/filter-chart.yaml",
  "full": "templates/full-dashboard.yaml",
};

// Parse CLI arg
const templateName = Deno.args[0] ?? "full";
const templateFile = TEMPLATES[templateName];
if (!templateFile) {
  console.error(`Unknown template: ${templateName}`);
  console.error(`Available: ${Object.keys(TEMPLATES).join(", ")}`);
  Deno.exit(1);
}

// Load manifests
async function loadManifest(name: string, env?: Record<string, string>): Promise<McpManifest> {
  const json = await Deno.readTextFile(`${STUBS_DIR}${name}/manifest.json`);
  const manifest = parseManifest(json);
  if (manifest.transport.type === "stdio") {
    manifest.transport.args = manifest.transport.args?.map((a) =>
      a.startsWith("stubs/") ? `${STUBS_DIR}../${a}` : a
    );
    if (env) manifest.transport.env = { ...manifest.transport.env, ...env };
  }
  return manifest;
}

const manifests = new Map<string, McpManifest>();
for (const name of ["stub-list", "stub-detail", "stub-chart", "stub-filter"]) {
  const env = name === "stub-list" ? { STUB_API_KEY: "demo" } : undefined;
  manifests.set(name, await loadManifest(name, env));
}

// Load and validate template
const template = await loadTemplate(`${STUBS_DIR}${templateFile}`);
const validation = validateTemplate(template, manifests);
if (!validation.valid) {
  console.error("Template validation failed:", validation.errors.join("; "));
  Deno.exit(1);
}

console.log(`Composing: ${template.name}`);
console.log(`Sources: ${template.sources.map((s) => s.manifest).join(", ")}`);

// Start cluster (stays alive for the duration of the demo)
const serverNames = template.sources.map((s) => s.manifest);
const cluster = createCluster(manifests, serverNames);
await cluster.startAll();
console.log("Cluster started.");

try {
  // Call tools and collect UI resources
  const collector = createCollector();
  for (const source of template.sources) {
    const resolvedCalls = injectArgs(source.calls, {});
    for (const call of resolvedCalls) {
      const qualifiedName = `${source.manifest}:${call.tool}`;
      const result = await cluster.callTool(source.manifest, call.tool, call.args);
      const collected = collector.collect(qualifiedName, result, call.args);
      if (!collected) console.warn(`Warning: ${qualifiedName} returned no UI metadata`);
    }
  }

  // Resolve ui:// URIs to real HTTP URLs
  const resources = collector.getResources().map((r) => {
    if (!r.resourceUri.startsWith("ui://")) return r;
    const serverName = r.resourceUri.slice("ui://".length).split("/")[0];
    const baseUrl = cluster.getUiBaseUrl(serverName);
    if (!baseUrl) return r;
    return { ...r, resourceUri: `${baseUrl}/ui?uri=${encodeURIComponent(r.resourceUri)}` };
  });

  // Build area map (source qualified name → area id)
  const areaMap: Record<string, string> = {};
  for (const source of template.sources) {
    if (source.id) {
      for (const call of source.calls) {
        areaMap[`${source.manifest}:${call.tool}`] = source.id;
      }
    }
  }

  // Compose and render
  const orchestration = {
    layout: template.orchestration.layout,
    sync: template.orchestration.sync,
    sharedContext: template.orchestration.sharedContext,
  };
  const descriptor = buildCompositeUi(resources, orchestration);
  if (Object.keys(areaMap).length > 0) {
    descriptor.areaMap = areaMap;
  }
  const html = renderComposite(descriptor);

  console.log(`Dashboard: ${descriptor.children.length} UIs, ${descriptor.sync.length} sync rules`);

  // Serve dashboard (cluster stays alive so iframes can load)
  const handle = await serveDashboard(html, { open: true });
  console.log(`Dashboard: ${handle.url}`);
  console.log("Press Ctrl+C to stop.");

  // Keep alive until Ctrl+C
  await new Promise<void>((resolve) => {
    Deno.addSignalListener("SIGINT", () => {
      console.log("\nShutting down...");
      resolve();
    });
  });

  await handle.shutdown();
} finally {
  await cluster.stopAll();
  console.log("Cluster stopped.");
}
