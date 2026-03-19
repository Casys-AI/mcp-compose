# RUNTIME-EXPLORATION.md — mcp-compose runtime layer

Document de réflexion. Rien n'est décidé. Exploration en cours.

---

## Contexte

mcp-compose `core/` est une lib pure (collect → compose → render). Mais pour que les
utilisateurs puissent réellement composer des dashboards, il faut :

1. **Déployer** des MCP servers (ou se connecter à des existants)
2. **Découvrir** leurs tools et events (`emits`/`accepts`)
3. **Composer** via `core/` (déjà fait)
4. **Servir** le résultat

Les étapes 1-2 et 4 n'existent pas encore. C'est le rôle d'un `runtime/`.

---

## Positionnement dans la stack Casys

| Projet | Rôle |
|---|---|
| **@casys/mcp-server** | Framework pour construire des MCP servers. Permet de déclarer `_meta.ui.resourceUri`, `emits`, `accepts`. |
| **mcp-compose `core/`** | Lib pure : collect → compose → render. Consomme les déclarations `emits`/`accepts` pour résoudre les sync rules. |
| **mcp-compose `runtime/`** | (NOUVEAU) Déploie/connecte des MCP servers, alimente `core/`, sert le résultat. |
| **@casys/mcp-bridge** | Sert les `ui://` dans Telegram/messaging. Consomme le HTML produit par compose. |

**Point clé** : seul `@casys/mcp-server` permet de déclarer les `emits`/`accepts`.
Donc dans un premier temps, seuls les MCPs construits avec notre framework supporteront
la composition avec sync events. Les MCPs tiers pourront être composés en layout
(split/tabs/grid) mais sans sync inter-UI.

---

## Architecture envisagée

```
mcp-compose/
├── src/
│   ├── core/       ← composition pure (INCHANGÉ, respecte ADR 0001)
│   ├── sdk/        ← adapters (INCHANGÉ)
│   ├── host/       ← contracts (INCHANGÉ)
│   └── runtime/    ← NOUVEAU
│       ├── types.ts         ← ServiceConfig, ClusterConfig
│       ├── cluster.ts       ← déploie et gère une grappe de MCP servers
│       ├── connector.ts     ← connecte aux MCP servers, appelle tools/list
│       ├── discovery.ts     ← récupère emits/accepts, propose le wiring
│       └── config.ts        ← parse la config (YAML ou programmatique)
├── cli/
│   └── mod.ts       ← mcp-compose up / discover / render
```

`core/` reste pur — zero I/O, déterministe. L'ADR 0001 est respecté.
`runtime/` est la couche d'exécution — I/O, réseau, process.

---

## Deux modes de déploiement

### Mode local (v1, prioritaire)

Tout tourne sur la machine de l'utilisateur.

- MCP servers lancés comme sous-process (`Deno.Command`)
- Communication stdio ou HTTP localhost
- Dashboard servi sur `localhost:8080`
- **Les données ne quittent jamais la machine de l'utilisateur**

Avantages :
- Simple à implémenter
- Pas de dépendance cloud
- Sécu : les credentials restent locaux
- Pas besoin de Subhosting

Use cases :
- Développeur qui explore ses données
- Utilisateur qui connecte sa propre base de données
- Prototypage rapide

### Mode managed (futur)

Les MCPs sont déployés sur Deno Subhosting.

- Chaque MCP = un worker Deno isolé (isolation V8)
- HTTPS automatique (`https://project-xxx.deno.dev`)
- Config via `envVars` dans l'API Subhosting
- Le code déployé est notre template (pas du code utilisateur)

Avantages :
- Dashboard partageable (URL publique)
- Pas d'infra à gérer pour l'utilisateur
- Isolation native entre clients

Use cases :
- Dashboard partagé avec des clients
- MCPs Casys pré-packagés (einvoice, erpnext)
- Offre SaaS

Compatibilité Deno/Node :
- Deno 2 a une compatibilité npm quasi totale
- Subhosting supporte npm dans les workers
- À vérifier : limites CPU/RAM pour des MCP servers

---

## Format de config (à affiner)

Le format doit être simple à écrire pour un humain ET facile à générer pour un LLM/agent.

### Option YAML

```yaml
services:
  einvoice:
    template: einvoice
    config:
      apiKey: "${EINVOICE_API_KEY}"

  erpnext:
    template: erpnext
    config:
      url: "https://kelly.erpnext.com"
      token: "${ERPNEXT_TOKEN}"

  # Use case "amène ta DB" (mode local uniquement)
  my-postgres:
    template: postgres
    config:
      connectionString: "${PG_CONNECTION_STRING}"

compose:
  layout: split
  sync:
    - from: einvoice:list_invoices
      event: select
      to: erpnext:get_order
      action: update
```

### Option programmatique (pour les agents/CLI)

```typescript
import { createCluster, compose } from "@casys/mcp-compose/runtime";

const cluster = await createCluster({
  einvoice: { template: "einvoice", config: { apiKey: "xxx" } },
  erpnext: { template: "erpnext", config: { url: "..." } },
});

const html = await compose(cluster, {
  layout: "split",
  sync: [{ from: "einvoice:list_invoices", event: "select", to: "erpnext:get_order", action: "update" }],
});
```

### Problématique de la complexité

Avec 10 MCPs et des cross-interactions, le YAML sync devient vite illisible.
Le `discover` (voir section CLI) pourrait auto-générer les sync rules à partir
des `emits`/`accepts` déclarés par les serveurs, mais ça ne remplace pas
l'intention de l'utilisateur.

**Question ouverte** : faut-il un MCP "composer" intelligent qui comprend
l'intention de l'utilisateur et génère les sync rules ? Ou un mode interactif
dans le CLI qui propose le wiring et laisse l'utilisateur valider ?

---

## CLI

```bash
# Lance les services + compose + sert le dashboard (mode local par défaut)
mcp-compose up

# Découvre les tools et events disponibles sur les services configurés
mcp-compose discover

# Génère le HTML sans servir
mcp-compose render --output dashboard.html
```

Le CLI est important parce que les agents (Claude, OpenClaw) travaillent bien
avec des CLIs — ils peuvent appeler `mcp-compose discover` pour comprendre
quels MCPs sont disponibles et quels events ils supportent, puis générer
le YAML de composition.

---

## Problématiques ouvertes

### 1. MCP Apps nécessite-t-il HTTP ?

Pour le rendu dans un navigateur, les iframes ont un `src="ui://..."`.
Le host doit résoudre `ui://` → URL HTTP pour que le navigateur charge le HTML.

- En mode managed (Subhosting) : chaque MCP a une URL HTTPS → OK
- En mode local : les MCPs tournent en localhost → le bridge ou le runtime
  doit servir de proxy qui résout les `ui://` via `resources/read` sur chaque MCP

**À vérifier** : est-ce que `@casys/mcp-server` `startHttp()` sert déjà les
`resources/read` en HTTP ? Si oui, le runtime peut juste réécrire les
`ui://` URI en URLs HTTP locales.

### 2. Sécu pour "amène ta DB"

Le template `postgres` est notre code — l'utilisateur ne peut pas injecter
du code arbitraire. Il fournit juste un `connectionString`. Mais :

- En mode local : OK, c'est sa machine
- En mode managed : le connection string irait dans les envVars du worker
  Subhosting. Le worker est sandboxé, mais la DB de l'utilisateur doit être
  accessible depuis Internet → risque

**Décision probable** : "amène ta DB" = mode local uniquement.

### 3. Comment un agent sait quoi composer ?

L'utilisateur ne va pas écrire le YAML à la main (surtout avec 10 MCPs).
Options :

- **CLI interactif** : `mcp-compose discover` liste les tools et events,
  l'utilisateur (ou l'agent) choisit lesquels wirer
- **MCP Composer** : un MCP server qui expose un tool `compose_dashboard`
  que l'agent peut appeler avec l'intention de l'utilisateur
- **LLM génère le YAML** : l'agent comprend l'intention, appelle `discover`,
  et génère le YAML avec les sync rules appropriées

**Question ouverte** : quel est le bon niveau d'abstraction ?

### 4. Relation stdio / HTTP pour la sync

La sync entre UIs passe par `postMessage` entre iframes dans le navigateur.
C'est 100% côté client (pas de round-trip serveur). Mais pour que les iframes
chargent leur HTML, il faut que les `ui://` soient résolus en HTTP.

Donc même en mode local avec des MCPs stdio, le runtime doit :
1. Appeler `resources/read` sur chaque MCP (stdio ou HTTP)
2. Servir le HTML résultant sur localhost
3. Le dashboard composé pointe ses iframes vers `localhost:PORT/ui?uri=...`

**C'est exactement ce que mcp-bridge fait déjà** avec sa route `/ui?uri=`.
Le runtime pourrait réutiliser mcp-bridge comme serveur de ressources.

---

*Document vivant. Mis à jour au fil des discussions.*
*Dernière mise à jour : 2026-03-18*
