---
kind: phase
name: phase-04-video-management
sources_mtime:
  docs/project-plan.md: "2026-08-31 22:18:23.872559222 -0300"
  docs/decisions/technical-decisions-video-management.md: "2026-09-01 20:20:22.832639110 -0300"
  docs/decisions/technical-decisions-openapi-docs-nestjs.md: "2026-08-31 22:18:23.870206069 -0300"
  docs/decisions/technical-decisions-next-frontend-config-base.md: "2026-08-31 22:18:23.870073071 -0300"
  docs/decisions/technical-decisions-next-frontend-openapi-typing.md: "2026-08-31 22:18:23.870206069 -0300"
  docs/decisions/technical-decisions-next-frontend-msw-foundation.md: "2026-08-31 22:18:23.870206069 -0300"
  docs/phases/phase-01-configuracao-base/context.md: "2026-08-31 22:18:23.871746970 -0300"
  docs/phases/phase-02-auth/context.md: "2026-08-31 22:18:23.872182547 -0300"
  docs/phases/phase-02-auth-frontend/context.md: "2026-08-31 22:18:23.871797307 -0300"
  docs/phases/phase-03-upload-processing/context.md: "2026-08-31 23:21:35.508204031 -0300"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-08-31 22:18:23.772557281 -0300"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-08-31 22:18:23.773628364 -0300"
---

# phase-04-video-management — Context

## Scope

**Phase name:** Gerenciamento de Vídeos e Canal

**Capabilities** (literal, `docs/project-plan.md`):

- Categorias de vídeo disponíveis na plataforma
- Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada
- Visibilidade do vídeo: público (aparece para todos) ou unlisted (somente via link)
- Fluxo de rascunho → publicação
- Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)
- Edição de vídeos a partir do painel
- Edição das informações do canal: nickname, nome e descrição
- Página pública do canal com informações e listagem de vídeos

**Out of scope:** _Not specified._

**Deliverables:** edição completa de vídeos, rascunho/publicação, painel de gerenciamento, edição de canal, página pública do canal.

**Affected subprojects:**

- `nestjs-project/` — categories entity + CRUD, video PATCH endpoint, thumbnail upload, channel update endpoint, video listing endpoints, published_at migration
- `next-frontend/` — dashboard page, video edit page, channel public page, channel settings page, components

**Deferred subprojects:** _None._

**Sequencing notes:** Depende de: Fase 02, Fase 03.

**Neighbors (for boundary detection only):**

- **Phase 03:** Upload e Processamento de Vídeos — Upload, processamento FFmpeg, streaming HLS, download.
- **Phase 05:** Página de Visualização do Vídeo — Player, sugestões, download, acesso anônimo.

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| video-management/TD-01 | phase | Backend | Video Category Model | decided | A (Fixed seeded categories) | — |
| video-management/TD-02 | phase | Backend | Video Update API Design | decided | A (PATCH partial update) | — |
| video-management/TD-03 | phase | Cross-layer | Custom Thumbnail Upload Strategy | decided | A (Dedicated multipart upload endpoint) | — |
| video-management/TD-04 | phase | Frontend | Channel Management Panel Architecture | decided | A (RSC-based dashboard with search params) | — |
| video-management/TD-05 | phase | Frontend | Channel Public Page — Rendering and Pagination | decided | A (RSC with cursor-based infinite scroll) | — |
| video-management/TD-06 | phase | Backend | Draft→Publish Validation Rules | decided | C (published_at timestamp) | — |
| video-management/TD-07 | phase | Backend | Channel Info Editing — Nickname Uniqueness | decided | A (Allow change with uniqueness check) | — |
| video-management/TD-08 | phase | Backend | Video List Data Enrichment | decided | A (Return what exists, placeholder zeros) | — |

_Source files:_

- video-management — `docs/decisions/technical-decisions-video-management.md` (scope_type: phase, related_phases: [4])

## Capability Coverage

| Capability (from project-plan.md) | Covered by |
|-----------------------------------|------------|
| Categorias de vídeo disponíveis na plataforma | video-management/TD-01 |
| Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada | video-management/TD-02, video-management/TD-03 |
| Visibilidade do vídeo: público ou unlisted | video-management/TD-02 |
| Fluxo de rascunho → publicação | video-management/TD-06 |
| Painel de gerenciamento de vídeos do canal | video-management/TD-04, video-management/TD-08 |
| Edição de vídeos a partir do painel | video-management/TD-02, video-management/TD-04 |
| Edição das informações do canal: nickname, nome e descrição | video-management/TD-07 |
| Página pública do canal com informações e listagem de vídeos | video-management/TD-05 |

## Decisions Detail

### video-management/TD-01

**Recommendation:** **Option A (Fixed seeded categories)** — Simplest path for an MVP. The Video entity already has `categoryId`. A seed migration is trivial. If the project later needs free tags, the migration from Option A to Option C is additive.
**Libraries:** —

### video-management/TD-02

**Recommendation:** **Option A (PATCH — partial update)** — RESTful, minimal bandwidth, aligns with react-hook-form patterns. The `null` ambiguity is solved by using a DTO with all optional fields.
**Libraries:** —

### video-management/TD-03

**Recommendation:** **Option A (Dedicated multipart upload endpoint)** — Simple, standard, server-side validation. The 2MB file size does not justify presigned URL complexity.
**Libraries:** —

### video-management/TD-04

**Recommendation:** **Option A (RSC-based dashboard with search params)** — For an MVP, RSC with search params is the simplest, fastest, and most maintainable approach.
**Libraries:** —

### video-management/TD-05

**Recommendation:** **Option A (RSC with cursor-based infinite scroll)** — Aligns with the ULID decision from Phase 03 (TD-06). Cursor pagination is efficient and the sortable ULID makes it trivial.
**Libraries:** —

### video-management/TD-06

**Recommendation:** **Option C (`published_at` timestamp)** — Cleanest separation of concerns. The existing `status` enum covers processing lifecycle. `published_at` covers intentional publication. `visibility` covers access control.
**Libraries:** —

### video-management/TD-07

**Recommendation:** **Option A (Allow change with uniqueness check)** — The MVP should allow users to customize their channel handle. Uniqueness validation reuses the existing `[a-z0-9_]` allowlist from Phase 02.
**Libraries:** —

### video-management/TD-08

**Recommendation:** **Option A (Return what exists, placeholder zeros)** — The frontend builds the full dashboard grid once. When Phase 06 adds real counts, only the backend query changes.
**Libraries:** —

## Inherited Decisions Detail

### upload-processing/TD-01

**Recommendation:** **Option A (MinIO)** — S3-compatible API means the same SDK works in dev and prod. Zero external cost, works offline, full control.
**Libraries:** @aws-sdk/client-s3

### upload-processing/TD-06

**Recommendation:** **Option A (ULID)** — Sortability is valuable for ordering video lists (home page, channel page) without an extra index on `created_at`.
**Libraries:** ulid

### phase-02-auth-frontend/TD-01

**Recommendation:** Option A (Custom BFF cookie-based session) — Architectural fit with strict-BFF model.
**Libraries:** —

### phase-02-auth-frontend/TD-02

**Recommendation:** Option B (iron-session encrypted container) — Defense in depth, single cookie.
**Libraries:** iron-session

### phase-02-auth-frontend/TD-04

**Recommendation:** Option A (react-hook-form + @hookform/resolvers/zod) — Decoupled from mutation pathway, aligned with shadcn.
**Libraries:** react-hook-form, @hookform/resolvers

### phase-02-auth-frontend/TD-05

**Recommendation:** Option A (Route Handler POST + client fetch) — Strict-BFF alignment.
**Libraries:** —

### openapi-docs-nestjs/TD-01

**Recommendation:** Option A (@nestjs/swagger) — preserves class-validator decisions.
**Libraries:** @nestjs/swagger

### next-frontend-config-base/TD-01

**Recommendation:** Option A (Zod 4) — Type-inference matches strict-TS culture.
**Libraries:** zod

### next-frontend-config-base/TD-02

**Recommendation:** Option A (@t3-oss/env-nextjs) — Runtime Proxy-based leak detection.
**Libraries:** @t3-oss/env-nextjs

### next-frontend-config-base/TD-03

**Recommendation:** Option A (Strict BFF — single server-only API_URL) — Eliminates CORS.
**Libraries:** —

### next-frontend-openapi-typing/TD-01

**Recommendation:** Option A (openapi-typescript + openapi-fetch) — Types-first.
**Libraries:** openapi-typescript, openapi-fetch

### next-frontend-msw-foundation/TD-01

**Recommendation:** Option B (per-domain modules + barrel) — Domain ownership tracks codebase.
**Libraries:** —

### next-frontend-msw-foundation/TD-04

**Recommendation:** Option A (universal handler set + server.use(...) overrides) — Loads all handlers.
**Libraries:** —

## Inherited Conventions

- Backend config uses `@nestjs/config` with namespaced `registerAs(name, () => ({...}))` factories. _(from phase 01)_
- Env variables validated by Joi schema in `src/config/env.validation.ts`. _(from phase 01)_
- `TypeOrmModule.forRootAsync` with `autoLoadEntities: true`, `synchronize: false`. _(from phase 01)_
- Strict BFF model: Route Handlers under `app/api/**` are the only NestJS caller. _(from phase 02 frontend)_
- Session management via `iron-session` encrypted cookie. _(from phase 02 frontend)_
- Transparent BFF refresh on upstream 401 with per-request single-flight. _(from phase 02 frontend)_
- `react-hook-form` + `@hookform/resolvers/zod` for forms. _(from phase 02 frontend)_
- Route Handler POST + client `fetch` for mutations. _(from phase 02 frontend)_
- MSW per-domain handlers barrel; universal handler set + `server.use()` overrides. _(from phase 02 frontend)_
- OpenAPI contract chain: `openapi.json` → `types.gen.ts` → `paths`. _(from phase 02 frontend)_
- Videos stored in MinIO, served via presigned URLs or streamed from StorageService. _(from phase 03)_
- Video entity with ULID primary key, status lifecycle (draft→uploading→processing→ready/failed). _(from phase 03)_
- Queue job `process-video` published to BullMQ on upload completion. _(from phase 03)_
- HLS streaming with adaptive bitrate via FFmpeg transcoding. _(from phase 03)_

## Inherited Deferred Capabilities

_No inherited deferred capabilities._

## UI Inventory

_Frontend-runtime only — no screen inventory needed for this phase.
Run /screen-inventory 04 if a UI surface is added in a future revision._

## Non-UI / Deferred Capabilities

_None._

## Testing Requirements

### nestjs-project

| Artifact type | Required layers |
|---------------|-----------------|
| Entity (`*.entity.ts`) | Integration: constraints, defaults, `select: false` |
| Service with branching + DB | Unit: branch logic (mock repo) + Integration: DB contract |
| Service with DB only (no branching) | Integration: DB contract |
| Service with configured lib (JWT, cache) | Unit: real lib with test config |
| Service with side-effect dep (email, storage) | Integration: real capture service (Mailpit) or local adapter |
| Module with configured imports | Unit: compilation test |
| Controller | E2E only — do NOT write unit tests |
| DTO | E2E: one validation wiring test per endpoint |
| Guard (delegates to service) | E2E + Unit if complex internal logic |
| Pipe (custom transformation) | Unit |
| Exception Filter | Unit + E2E |
| Middleware | E2E |

### next-frontend

| Artifact type | Required layers |
|---------------|-----------------|
| Page — async RSC | `*.e2e-spec.ts` only |
| Client component with state/handlers | `*.test.ts` — RTL + jsdom, mock `next/navigation` and `fetch` |
| Route handler with branching | `*.test.ts` (pure logic) and/or `*.integration.test.ts` with MSW |
| Route handler (simple proxy) | `*.integration.test.ts` with MSW only |
| `lib/` utility with branching | `*.test.ts` |
| Custom hook (`hooks/*`) | `*.test.ts` with `renderHook` |