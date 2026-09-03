---
kind: phase
name: phase-05-watch-page
sources_mtime:
  docs/project-plan.md: "2026-08-31 22:18:23.872559222 -0300"
  docs/decisions/technical-decisions-watch-page.md: "2026-09-02 21:53:34.219773826 -0300"
  docs/decisions/technical-decisions-openapi-docs-nestjs.md: "2026-08-31 22:18:23.870206069 -0300"
  docs/decisions/technical-decisions-next-frontend-config-base.md: "2026-08-31 22:18:23.870073071 -0300"
  docs/decisions/technical-decisions-next-frontend-openapi-typing.md: "2026-08-31 22:18:23.870206069 -0300"
  docs/decisions/technical-decisions-next-frontend-msw-foundation.md: "2026-08-31 22:18:23.870206069 -0300"
  docs/phases/phase-03-upload-processing/context.md: "2026-08-31 23:21:35.508204031 -0300"
  docs/phases/phase-04-video-management/context.md: "2026-09-01 20:04:55.062420711 -0300"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-08-31 22:18:23.772557281 -0300"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-08-31 22:18:23.773628364 -0300"
---

# phase-05-watch-page — Context

## Scope

**Phase name:** Página de Visualização do Vídeo

**Capabilities** (literal, `docs/project-plan.md`):

- Player de vídeo com controles: play/pause, volume e barra de progresso
- Layout da página: vídeo principal + informações + sidebar com sugestões
- Descrição do vídeo com expansão/recolhimento
- Contagem de visualizações
- Sugestões de vídeos da mesma categoria na sidebar
- Acesso anônimo à visualização de vídeos
- Botão de download do vídeo
- Vídeos unlisted acessíveis apenas via link direto (sem aparecer em listagens)

**Out of scope:** _Not specified._

**Deliverables:** página de visualização com player funcional, sidebar de sugestões, download e acesso anônimo.

**Affected subprojects:**

- `nestjs-project/` — view tracking table + endpoint, suggested videos query, unlisted filtering on list queries, view count increment
- `next-frontend/` — watch page at /watch/[id], description expand, suggested videos sidebar, download button, view tracking BFF

**Deferred subprojects:** _None._

**Sequencing notes:** Depende de: Fase 03, Fase 04.

**Neighbors (for boundary detection only):**

- **Phase 04:** Gerenciamento de Vídeos e Canal — Categories, video editing, dashboard, channel page.
- **Phase 06:** Interações Sociais — Likes, comments, subscriptions.

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| watch-page/TD-01 | phase | Backend | View Counting Strategy | decided | B (IP + 24h window) | — |
| watch-page/TD-02 | phase | Backend | Suggested Videos Query Strategy | decided | B (Same category + fallback) | — |
| watch-page/TD-03 | phase | Cross-layer | Unlisted Video Access Strategy | decided | A (Backend filter + ULID entropy) | — |
| watch-page/TD-04 | phase | Frontend | Watch Page Layout Architecture | decided | A (RSC + client components) | — |

_Source files:_

- watch-page — `docs/decisions/technical-decisions-watch-page.md` (scope_type: phase, related_phases: [5])

## Capability Coverage

| Capability (from project-plan.md) | Covered by |
|-----------------------------------|------------|
| Player de vídeo com controles: play/pause, volume e barra de progresso | watch-page/TD-04 |
| Layout da página: vídeo principal + informações + sidebar com sugestões | watch-page/TD-04 |
| Descrição do vídeo com expansão/recolhimento | watch-page/TD-04 |
| Contagem de visualizações | watch-page/TD-01 |
| Sugestões de vídeos da mesma categoria na sidebar | watch-page/TD-02 |
| Acesso anônimo à visualização de vídeos | watch-page/TD-03, watch-page/TD-04 |
| Botão de download do vídeo | watch-page/TD-04 |
| Vídeos unlisted acessíveis apenas via link direto | watch-page/TD-03 |

## Decisions Detail

### watch-page/TD-01

**Recommendation:** **Option B (IP + 24h window)** — Best balance of accuracy and simplicity. The `video_views` table is a single migration. A cleanup job deletes rows older than 24h. IP-based dedup is the YouTube standard for MVP accuracy.
**Libraries:** —

### watch-page/TD-02

**Recommendation:** **Option B (Same category + fallback)** — Best UX for an MVP. Videos in the same category are most relevant. If the category is sparse, supplement with recent videos.
**Libraries:** —

### watch-page/TD-03

**Recommendation:** **Option A (Backend filter + ULID entropy)** — The ULID is already unguessable. Adding `WHERE visibility = 'public'` to all list queries is sufficient. A share token system can be added later.
**Libraries:** —

### watch-page/TD-04

**Recommendation:** **Option A (RSC + client components)** — The HlsPlayer component already exists from Phase 03. Description expand/collapse is a small Client Component. Everything else server-rendered.
**Libraries:** —

## Inherited Decisions Detail

### upload-processing/TD-04

**Recommendation:** **Option A (HLS with multiple quality variants)** — Adaptive bitrate is critical for a video platform. HLS is the most widely supported streaming format.
**Libraries:** hls.js

### upload-processing/TD-06

**Recommendation:** **Option A (ULID)** — Sortability is valuable for ordering video lists without an extra index on `created_at`.
**Libraries:** ulid

### video-management/TD-02

**Recommendation:** **Option A (PATCH — partial update)** — RESTful, minimal bandwidth, aligns with react-hook-form patterns.
**Libraries:** —

### video-management/TD-03

**Recommendation:** **Option A (Dedicated multipart upload endpoint)** — Simple, standard, server-side validation.
**Libraries:** —

### video-management/TD-08

**Recommendation:** **Option A (Return what exists, placeholder zeros)** — Frontend builds the full dashboard grid once.
**Libraries:** —

### phase-02-auth-frontend/TD-01

**Recommendation:** Option A (Custom BFF cookie-based session) — Architectural fit with strict-BFF model.
**Libraries:** —

### phase-02-auth-frontend/TD-02

**Recommendation:** Option B (iron-session encrypted container) — Defense in depth, single cookie.
**Libraries:** iron-session

### openapi-docs-nestjs/TD-01

**Recommendation:** Option A (@nestjs/swagger) — preserves class-validator decisions.
**Libraries:** @nestjs/swagger

### next-frontend-config-base/TD-01

**Recommendation:** Option A (Zod 4) — Type-inference matches strict-TS culture.
**Libraries:** zod

### next-frontend-openapi-typing/TD-01

**Recommendation:** Option A (openapi-typescript + openapi-fetch) — Types-first.
**Libraries:** openapi-typescript, openapi-fetch

## Inherited Conventions

- Strict BFF model: Route Handlers under `app/api/**` are the only NestJS caller. _(from phase 02 frontend)_
- Session management via `iron-session` encrypted cookie. _(from phase 02 frontend)_
- Route Handler POST + client `fetch` for mutations. _(from phase 02 frontend)_
- MSW per-domain handlers barrel; universal handler set + `server.use()` overrides. _(from phase 02 frontend)_
- OpenAPI contract chain: `openapi.json` → `types.gen.ts` → `paths`. _(from phase 02 frontend)_
- Videos stored in MinIO, served via stream from StorageService. _(from phase 03)_
- HLS streaming with adaptive bitrate via HlsPlayer component. _(from phase 03)_
- Video entity with ULID primary key, status lifecycle, visibility field. _(from phase 03)_
- Categories seeded with 12 predefined values. _(from phase 04)_
- Video PATCH endpoint for metadata updates. _(from phase 04)_
- Channel public page with cursor-based pagination. _(from phase 04)_

## UI Inventory

_Frontend-runtime only — no screen inventory needed for this phase.
Run /screen-inventory 05 if a UI surface is added in a future revision._

## Non-UI / Deferred Capabilities

_None._

## Testing Requirements

### nestjs-project

| Artifact type | Required layers |
|---------------|-----------------|
| Entity (`*.entity.ts`) | Integration: constraints, defaults |
| Service with branching + DB | Unit: branch logic (mock repo) + Integration: DB contract |
| Module with configured imports | Unit: compilation test |
| Controller | E2E only |

### next-frontend

| Artifact type | Required layers |
|---------------|-----------------|
| Page — async RSC | `*.e2e-spec.ts` only |
| Client component with state/handlers | `*.test.ts` — RTL + jsdom, mock `next/navigation` and `fetch` |
| Route handler with branching | `*.test.ts` and/or `*.integration.test.ts` with MSW |
| Route handler (simple proxy) | `*.integration.test.ts` with MSW only |