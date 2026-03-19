# RUNTIME-EXPLORATION.md — mcp-compose runtime layer

> **Status: Implemented (2026-03-19).** The runtime module is in `src/runtime/`.
> This document records the exploration and decisions made. See `src/runtime/readme.md`
> for the current API.

---

## Contexte

mcp-compose `core/` est une lib pure (collect -> compose -> render). Pour que les
utilisateurs puissent réellement composer des dashboards, il faut :

1. **Démarrer** des MCP servers (ou se connecter à des existants)
2. **Appeler** leurs tools pour obtenir les UI resources
3. **Composer** via `core/` (déjà fait)
4. **Servir** le résultat (résolution des `ui://` URIs)

Le `runtime/` couvre les étapes 1-2 et 4.

---

## Décisions prises

### Transport : HTTP only

Le runtime utilise HTTP pour toutes les communications (tool calls + UI serving).
Pas de JSON-RPC over stdio — trop complexe à implémenter pour un bénéfice nul.

- **Mode stdio** : le cluster démarre le process avec `--http --port=0`,
  détecte le port dynamique sur stderr, puis communique en HTTP.
- **Mode http** : connexion directe à un serveur existant via son URL.

Les deux modes utilisent `fetch()` — zéro implémentation de protocole custom.

### Manifestes statiques

Les `emits`/`accepts` sont déclarés dans le code via `uiMeta()` et extraits
au build time dans un fichier JSON. Pas besoin de démarrer un serveur pour
la discovery.

### Templates YAML

Les dashboards sont définis en YAML (output de l'agent, pas écrit à la main).
Les templates ne contiennent pas d'args runtime — les `{{placeholder}}` sont
injectés au moment de `composeDashboard()`.

### Résolution ui://

Les URIs `ui://server-name/path` sont résolues automatiquement par le runtime
en `${uiBaseUrl}/ui?uri=...` avant le rendu. Le serveur MCP (via Hono) sert
les UIs sur la même URL que les tool calls.

### Pas de mcp-bridge

Le runtime n'utilise pas mcp-bridge. La résolution des `ui://` est gérée
directement par le runtime via les `uiBaseUrl` des connexions.

---

## Architecture implémentée

```
src/runtime/
  types.ts        — McpManifest, DashboardTemplate, transports, ComposeRequest/Result
  manifest.ts     — parse/validate/load manifestes JSON
  template.ts     — parse YAML, validate, injectArgs {{placeholder}}
  cluster.ts      — startServer (stdio->http), connectHttp, createCluster
  compose.ts      — composeDashboard() orchestrateur complet
  mod.ts          — exports publics
```

### Flow complet

```
1. Lire les manifestes (statique, build time)
2. L'agent choisit la grappe + propose le wiring → génère le template YAML
3. composeDashboard({ template, manifests, args })
   a. Valide le template contre les manifestes
   b. Démarre/connecte les MCPs (cluster)
   c. Appelle les tools avec args injectés
   d. Collecte les UI resources
   e. Résout les ui:// URIs
   f. Pipeline core : buildCompositeUi → renderComposite
   g. Stop le cluster (finally)
4. → HTML dashboard self-contained
```

---

## Problématiques résolues

| Question | Décision |
|---|---|
| Stdio vs HTTP ? | HTTP only. Stdio = process management uniquement. |
| Qui sert les UIs ? | Le serveur MCP lui-même (Hono). |
| Comment découvrir les emits/accepts ? | Manifeste statique (build time). |
| Comment l'agent compose ? | Il génère un template YAML. |
| Faut-il un CLI ? | Non pour v1. L'agent appelle `composeDashboard()` directement. |
| mcp-bridge ? | Non utilisé. |

## Travail futur

- [ ] Tests d'intégration avec un vrai serveur MCP mock
- [ ] Mode managed (Deno Subhosting) pour dashboards partagés
- [ ] Dashboard persistence (save/load templates)
- [ ] Sync rule auto-discovery depuis emits/accepts des manifestes

*Dernière mise à jour : 2026-03-19*
