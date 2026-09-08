---
kind: phase
name: phase-06-social
sources_mtime:
  docs/project-plan.md: "2026-08-31 22:18:23.872559222 -0300"
  docs/decisions/technical-decisions-social.md: "2026-09-02 22:39:24.165554036 -0300"
  docs/decisions/technical-decisions-openapi-docs-nestjs.md: "2026-08-31 22:18:23.870206069 -0300"
  docs/decisions/technical-decisions-next-frontend-config-base.md: "2026-08-31 22:18:23.870073071 -0300"
  docs/decisions/technical-decisions-next-frontend-openapi-typing.md: "2026-08-31 22:18:23.870206069 -0300"
  docs/decisions/technical-decisions-next-frontend-msw-foundation.md: "2026-08-31 22:18:23.870206069 -0300"
  docs/phases/phase-02-auth/context.md: "2026-08-31 22:18:23.872182547 -0300"
  docs/phases/phase-05-watch-page/context.md: "2026-09-02 21:55:39.044449606 -0300"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-08-31 22:18:23.772557281 -0300"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-08-31 22:18:23.773628364 -0300"
---

# phase-06-social — Context

## Scope

**Phase name:** Interações Sociais (Likes, Comentários, Inscrições)

**Capabilities** (literal, `docs/project-plan.md`):

- Like e dislike em vídeos (usuários autenticados)
- Comentários em vídeos (usuários autenticados)
- Respostas a comentários (comentários aninhados)
- Like e dislike em comentários (usuários autenticados)
- Inscrição em canais (seguir/deixar de seguir)
- Área de canais seguidos com acesso rápido aos vídeos
- Contagem de inscritos na página do canal
- Interface completa de comentários, likes e inscrições

**Out of scope:** _Not specified._

**Deliverables:** likes/dislikes funcionando, comentários com respostas, inscrição em canais, listagem de canais seguidos.

**Affected subprojects:**

- `nestjs-project/` — video_likes, comments, comment_likes, subscriptions entities + endpoints + migrations
- `next-frontend/` — like/dislike buttons, comment section, subscribe button, followed channels area, subscriptions page

**Deferred subprojects:** _None._

**Sequencing notes:** Depende de: Fase 02, Fase 05.

**Neighbors (for boundary detection only):**

- **Phase 05:** Página de Visualização do Vídeo — Watch page, player, suggestions, download.
- **Phase 07:** Página Inicial, Busca e Finalização — Home page, search, navbar, responsive layout.

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| social/TD-01 | phase | Backend | Video Like/Dislike Model | decided | A (Single video_likes table) | — |
| social/TD-02 | phase | Backend | Comments Model — Nesting Depth | decided | A (Single-level, max 2 levels) | — |
| social/TD-03 | phase | Backend | Comment Like/Dislike Model | decided | A (Separate comment_likes table) | — |
| social/TD-04 | phase | Backend | Subscription Model | decided | A (Subscriptions table + counter) | — |
| social/TD-05 | phase | Frontend | Followed Channels — Data Source | decided | A + C (RSC sidebar + dedicated page) | — |
| social/TD-06 | phase | Backend | Comment Pagination Strategy | decided | A (Cursor-based) | — |

_Source files:_

- social — `docs/decisions/technical-decisions-social.md` (scope_type: phase, related_phases: [6])

## Capability Coverage

| Capability (from project-plan.md) | Covered by |
|-----------------------------------|------------|
| Like e dislike em vídeos (usuários autenticados) | social/TD-01 |
| Comentários em vídeos (usuários autenticados) | social/TD-02, social/TD-06 |
| Respostas a comentários (comentários aninhados) | social/TD-02 |
| Like e dislike em comentários (usuários autenticados) | social/TD-03 |
| Inscrição em canais (seguir/deixar de seguir) | social/TD-04 |
| Área de canais seguidos com acesso rápido aos vídeos | social/TD-05 |
| Contagem de inscritos na página do canal | social/TD-04 |
| Interface completa de comentários, likes e inscrições | social/TD-01, social/TD-02, social/TD-03, social/TD-04, social/TD-05 |

## Decisions Detail

### social/TD-01

**Recommendation:** **Option A (Single `video_likes` table)** — Single table, simple toggle, unique constraint prevents duplicates. Count queries are fast with an index on `(video_id, is_like)`.
**Libraries:** —

### social/TD-02

**Recommendation:** **Option A (Single-level nesting, max 2 levels)** — Users can reply to comments, but replies cannot have replies. Avoids the "infinite thread" problem. Model is simple and queries fast.
**Libraries:** —

### social/TD-03

**Recommendation:** **Option A (Separate `comment_likes` table)** — Consistent with video likes. Simple, type-safe, with proper FK constraints.
**Libraries:** —

### social/TD-04

**Recommendation:** **Option A (Subscriptions table + denormalized counter)** — Counter column is simple. Update is atomic via increment/decrement. Drift risk minimal.
**Libraries:** —

### social/TD-05

**Recommendation:** **Option A + C (RSC sidebar + dedicated page)** — Sidebar on home page shows followed channels. `/subscriptions` page shows latest videos.
**Libraries:** —

### social/TD-06

**Recommendation:** **Option A (Cursor-based)** — Consistent with ULID-based cursor pagination used in Phases 03 and 04.
**Libraries:** —

## Inherited Decisions Detail

### phase-02-auth/TD-01

**Recommendation:** Argon2id — OWASP-recommended for new projects.
**Libraries:** argon2

### phase-02-auth/TD-02

**Recommendation:** Custom guards with @nestjs/jwt only — fewer dependencies.
**Libraries:** @nestjs/jwt

### phase-02-auth-frontend/TD-01

**Recommendation:** Option A (Custom BFF cookie-based session) — Architectural fit with strict-BFF model.
**Libraries:** —

### phase-02-auth-frontend/TD-02

**Recommendation:** Option B (iron-session encrypted container) — Defense in depth, single cookie.
**Libraries:** iron-session

### phase-02-auth-frontend/TD-04

**Recommendation:** Option A (react-hook-form + @hookform/resolvers/zod) — Decoupled from mutation pathway.
**Libraries:** react-hook-form, @hookform/resolvers

### phase-02-auth-frontend/TD-05

**Recommendation:** Option A (Route Handler POST + client fetch) — Strict-BFF alignment.
**Libraries:** —

### upload-processing/TD-06

**Recommendation:** Option A (ULID) — Sortability for ordering video lists.
**Libraries:** ulid

### watch-page/TD-01

**Recommendation:** Option B (IP + 24h window) — View counting with video_views table.
**Libraries:** —

### watch-page/TD-04

**Recommendation:** Option A (RSC + client components) — Watch page layout architecture.
**Libraries:** —

### openapi-docs-nestjs/TD-01

**Recommendation:** Option A (@nestjs/swagger) — preserves class-validator decisions.
**Libraries:** @nestjs/swagger

### next-frontend-config-base/TD-01

**Recommendation:** Option A (Zod 4) — Type-inference matches strict-TS culture.
**Libraries:** zod

### next-frontend-openapi-typing/TD-01

**Recommendation:** Option A (openapi-typescript + openapi-fetch) — Types-first.
**Libraries:** openapi-typescript, openapi-fetch

### next-frontend-msw-foundation/TD-01

**Recommendation:** Option B (per-domain modules + barrel) — Domain ownership.
**Libraries:** —

## Inherited Conventions

- Strict BFF model: Route Handlers under `app/api/**` are the only NestJS caller. _(from phase 02 frontend)_
- Session management via `iron-session` encrypted cookie. _(from phase 02 frontend)_
- Route Handler POST + client `fetch` for mutations. _(from phase 02 frontend)_
- MSW per-domain handlers barrel; universal handler set + `server.use()` overrides. _(from phase 02 frontend)_
- OpenAPI contract chain: `openapi.json` → `types.gen.ts` → `paths`. _(from phase 02 frontend)_
- Video entity with ULID primary key. _(from phase 03)_
- HLS streaming with adaptive bitrate via HlsPlayer component. _(from phase 03)_
- Watch page at `/watch/[id]` with RSC + client components. _(from phase 05)_
- View counting with IP-based 24h dedup. _(from phase 05)_

## UI Inventory

_Frontend-runtime only — no screen inventory needed for this phase.
Run /screen-inventory 06 if a UI surface is added in a future revision._

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