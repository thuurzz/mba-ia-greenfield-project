---
kind: phase
name: phase-03-videos
sources_mtime:
  docs/project-plan.md: "2026-08-31 22:18:23.872559222 -0300"
  docs/decisions/technical-decisions-upload-processing.md: "2026-08-31 23:19:40.539240480 -0300"
  docs/decisions/technical-decisions-openapi-docs-nestjs.md: "2026-08-31 22:18:23.870206069 -0300"
  docs/decisions/technical-decisions-next-frontend-config-base.md: "2026-08-31 22:18:23.870073071 -0300"
  docs/decisions/technical-decisions-next-frontend-openapi-typing.md: "2026-08-31 22:18:23.870206069 -0300"
  docs/decisions/technical-decisions-next-frontend-msw-foundation.md: "2026-08-31 22:18:23.870206069 -0300"
  docs/phases/phase-01-configuracao-base/context.md: "2026-08-31 22:18:23.871746970 -0300"
  docs/phases/phase-02-auth/context.md: "2026-08-31 22:18:23.872182547 -0300"
  docs/phases/phase-02-auth-frontend/context.md: "2026-08-31 22:18:23.871797307 -0300"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-08-31 22:18:23.772557281 -0300"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-08-31 22:18:23.773628364 -0300"
---

# phase-03-videos — Context

## Scope

**Phase name:** Upload e Processamento de Vídeos

**Capabilities** (literal, `docs/project-plan.md`):

- Serviço de armazenamento de arquivos (vídeos e thumbnails)
- Serviço de processamento em segundo plano (filas)
- Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance
- Pré-cadastro automático do vídeo como rascunho ao iniciar o upload
- Processamento automático do vídeo após upload (extração de duração e metadados)
- Geração automática de thumbnail a partir de um frame do vídeo
- URL única por vídeo, sem conflito com outros vídeos
- Reprodução via streaming (sem necessidade de download completo)
- Download do vídeo pelo usuário

**Out of scope:** _Not specified._

**Deliverables:** upload de até 10GB funcional, processamento automático do vídeo, streaming funcionando, URLs únicas geradas.

**Affected subprojects:**

- `nestjs-project/` — primary subproject. Armazenamento MinIO, upload tus, fila BullMQ+Redis, worker FFmpeg, entidade vídeo, endpoints REST (upload, download, stream, list), geração thumbnail.
- `next-frontend/` — upload UI com tus-js-client com barra de progresso, player HLS com hls.js, download button. BFF route handlers em `app/api/videos/`.

**Deferred subprojects:** _None._

**Sequencing notes:** Depende de: Fase 01, Fase 02.

**Neighbors (for boundary detection only):**

- **Phase 02:** Cadastro, Login e Gerenciamento de Conta — Fluxo completo de criação de conta, confirmação por e-mail, login, logout e recuperação de senha.
- **Phase 04:** Gerenciamento de Vídeos e Canal — Edição de informações, rascunho e publicação, painel de administração do canal e página pública.

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| upload-processing/TD-01 | phase | Cross-layer | Object Storage Service | decided | A (MinIO) | @aws-sdk/client-s3, @nestjs/s3 |
| upload-processing/TD-02 | phase | Cross-layer | Upload Protocol | decided | A (tus resumable upload) | @tus/server, tus-js-client |
| upload-processing/TD-03 | phase | Backend | Message Queue | decided | A (BullMQ + Redis) | @nestjs/bullmq, bullmq, ioredis |
| upload-processing/TD-04 | phase | Backend | Video Processing Worker — FFmpeg Output Format | decided | A (HLS with multi-quality variants) | hls.js (frontend) |
| upload-processing/TD-05 | phase | Backend | Thumbnail Generation Strategy | decided | A (FFmpeg frame extraction at worker time) | — |
| upload-processing/TD-06 | phase | Cross-layer | Unique Video Identifier Format | decided | A (ULID) | ulid |
| upload-processing/TD-07 | phase | Backend | Draft Video Creation Strategy | pending | — | — |

_Source files:_

- upload-processing — `docs/decisions/technical-decisions-upload-processing.md` (scope_type: phase, related_phases: [3])

## Capability Coverage

| Capability (from project-plan.md) | Covered by |
|-----------------------------------|------------|
| Serviço de armazenamento de arquivos (vídeos e thumbnails) | upload-processing/TD-01 |
| Serviço de processamento em segundo plano (filas) | upload-processing/TD-03 |
| Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance | upload-processing/TD-02 |
| Pré-cadastro automático do vídeo como rascunho ao iniciar o upload | upload-processing/TD-07 |
| Processamento automático do vídeo após upload (extração de duração e metadados) | upload-processing/TD-03, upload-processing/TD-04 |
| Geração automática de thumbnail a partir de um frame do vídeo | upload-processing/TD-05 |
| URL única por vídeo, sem conflito com outros vídeos | upload-processing/TD-06 |
| Reprodução via streaming (sem necessidade de download completo) | upload-processing/TD-04 |
| Download do vídeo pelo usuário | upload-processing/TD-04 |

## Decisions Detail

### upload-processing/TD-01

**Recommendation:** **Option A (MinIO)** — S3-compatible API means the same SDK works in dev and prod. Zero external cost, works offline, full control. Add to `compose.yaml` as a new service alongside `db` and `mailpit`. The backend uses `@aws-sdk/client-s3` (available as `@nestjs/s3` for NestJS DI integration). Production swap to AWS S3 is a credentials-only change.
**Libraries:** @aws-sdk/client-s3, @nestjs/s3

### upload-processing/TD-02

**Recommendation:** **Option A (tus)** — Resumability is the decisive factor for 10GB files on real-world networks. `@tus/server` integrates with Express/NestJS, `tus-js-client` gives the browser pause/resume. The temporary chunk storage can be a temp directory or a dedicated MinIO bucket. Option B is a close second and may be revisited if the team prefers zero-server-bandwidth; the migration from tus to presigned is a frontend + one endpoint change, not an architecture rebuild.
**Libraries:** @tus/server, tus-js-client

### upload-processing/TD-03

**Recommendation:** **Option A (BullMQ + Redis)** — NestJS-native, idiomatic, provides job progress reporting and retry. Redis is lightweight (~50MB RAM, vs RabbitMQ's ~200MB) and can serve future caching needs (rate limiting store, session cache in Phase 06+). The `@nestjs/bullmq` decorators (`@Processor`, `@Process`) mirror NestJS conventions. RabbitMQ is overkill for a single video-processing queue; in-process is disqualified for blocking the API and losing jobs on failure.
**Libraries:** @nestjs/bullmq, bullmq, ioredis

### upload-processing/TD-04

**Recommendation:** **Option A (HLS with multiple quality variants)** — Adaptive bitrate is critical for a video platform serving diverse connection qualities. HLS is the most widely supported streaming format across browsers (hls.js for Chrome/Firefox, native for Safari/iOS). The CPU cost of transcoding is acceptable for a background worker (the user does not wait). Storage multiplication is a known cost of any multi-quality streaming service. DASH offers no practical advantage over HLS for this project's target browsers. The original uploaded file is preserved in MinIO for download (TD-01).
**Libraries:** hls.js

### upload-processing/TD-05

**Recommendation:** **Option A (FFmpeg frame extraction** — Simple, zero extra infrastructure, configured within the existing BullMQ worker. Scene-detection filter (`select='gt(scene,0.4)'`) improves quality without adding services. Thumbnail stored as WebP in MinIO for small file size, with a JPEG fallback for og:image.
**Libraries:** —

### upload-processing/TD-06

**Recommendation:** **Option A (ULID)** — Sortability is valuable for ordering video lists (home page, channel page) without an extra index on `created_at`. 26 chars are compact. The ULID prefix includes the timestamp, which helps debugging (you can read "when was this ID generated" from the ID alone). Store as `varchar(26)` in TypeORM with a custom value transformer. UUID v4 does not sort; NanoID does not sort and is less standard.
**Libraries:** ulid

### upload-processing/TD-07

**Recommendation:** **Option A (Create draft on upload initiation)** — User expects "Uploading..." and "Processing..." states immediately. Draft records enable dashboard visibility, retry, and progress tracking. Orphan cleanup is simple scheduled job.
**Libraries:** —

## Inherited Decisions Detail

### phase-01-configuracao-base/TD-01

**Recommendation:** Option A (@nestjs/config) — Official, core-team-maintained, guaranteed NestJS 11 compatibility. The `registerAs()` factory pattern solves the TypeORM CLI sharing problem: the factory function can be imported as a plain function by `data-source.ts` while also serving as a DI injection token inside NestJS. Building a custom module recreates solved functionality; third-party packages carry maintenance risk.
**Libraries:** `@nestjs/config@^4.x`

### phase-01-configuracao-base/TD-02

**Recommendation:** Option A (Joi) — First-class integration with `@nestjs/config` via `validationSchema`, requiring zero custom wiring. Handles string-to-number coercion natively. Using a different tool for env validation vs. request validation is reasonable — env config is validated once at startup, DTOs are validated per-request. Zod is elegant but adds a third validation paradigm to the project.
**Libraries:** `joi@^17.x`

### phase-01-configuracao-base/TD-03

**Recommendation:** Option B (Namespaced/grouped with registerAs) — The project roadmap explicitly calls for auth, email, and storage in upcoming phases. Namespaced configs provide clear file boundaries per domain, typed injection via `ConfigType<typeof databaseConfig>`, and natural scalability. The `registerAs()` factory is dual-purpose: DI token inside NestJS and plain importable function for `data-source.ts`.
**Libraries:** —

### phase-01-configuracao-base/TD-04

**Recommendation:** Option A (Shared registerAs factory) — Natural outcome of choosing `@nestjs/config` with `registerAs`. The factory is already callable by design. `data-source.ts` imports it, calls `dotenv.config()`, then calls the factory. Zero duplication, minimal code, no extra abstraction.
**Libraries:** `dotenv` (transitive via `@nestjs/config`)

### phase-02-auth/TD-01

**Recommendation:** Argon2id — For a greenfield project in 2026, Argon2id is the OWASP-recommended choice. The native build dependency is a one-time Docker setup cost. The project has no legacy constraints favoring bcrypt.
**Libraries:** argon2

### phase-02-auth/TD-02

**Recommendation:** Option A (@nestjs/passport) — The project plan includes only email/password auth for now, but the plugin architecture costs little and future phases may add social login. Aligns with official NestJS docs, making onboarding and maintenance easier.
**Libraries:** @nestjs/jwt

### phase-02-auth/TD-03

**Recommendation:** Option A (Refresh Token Rotation) — Provides the strongest security model with automatic theft detection. The DB write overhead is acceptable for a video platform (auth refresh is infrequent vs. video operations). PostgreSQL is already in the stack, so no new infrastructure needed. Race conditions can be mitigated with a short grace period for the old token.
**Libraries:** —

### phase-02-auth/TD-04

**Recommendation:** Option B (Random Opaque Tokens in DB) — Revocability is important: when a user requests a new password reset, previous tokens should be invalidated. The DB table is trivial to implement, and the tokens table can also serve future needs (e.g., API keys). Keeps email tokens decoupled from the JWT auth system.
**Libraries:** —

### phase-02-auth/TD-05

**Recommendation:** Option A (@nestjs-modules/mailer) — Best NestJS integration with minimal boilerplate. Supports SMTP (matching the architecture diagram), works with Mailpit for local development without external dependencies, and scales to any SMTP provider in production.
**Libraries:** @nestjs-modules/mailer

### phase-02-auth/TD-06

**Recommendation:** Option A (class-validator + class-transformer) — This is a backend-only project (no shared schemas with frontend), so Zod's single-source-of-truth advantage is less impactful. class-validator is the documented NestJS approach.
**Libraries:** class-validator, class-transformer

### phase-02-auth/TD-07

**Recommendation:** Option A (Custom Domain Exception Filter) — Provides machine-readable error codes that the Next.js frontend can switch on, without the overhead of RFC 9457's URI-based type system.
**Libraries:** —

### phase-02-auth/TD-08

**Recommendation:** Option A (@nestjs/throttler) — Native NestJS integration is decisive: the guard system allows scoping rate limiting to `AuthModule` only via module-level `APP_GUARD`, with `@SkipThrottle()` for exemptions.
**Libraries:** @nestjs/throttler

### phase-02-auth/TD-09

**Recommendation:** Option B (Opaque) — Since DB lookup is mandatory (TD-03), JWT signature adds no security value. Opaque tokens are shorter, leak no data, and are simpler to generate.
**Libraries:** —

### phase-02-auth/TD-10

**Recommendation:** Option A — The platform is a video sharing service with URL-based channel handles. A strict `[a-z0-9_]` allowlist is the simplest and most portable choice: no extra dependencies, no edge cases around hyphen positioning.
**Libraries:** —

### phase-02-auth-frontend/TD-01

**Recommendation:** Three reasons. (1) **Architectural fit.** The strict-BFF model in `next-frontend-config-base/TD-03` already nominates the Route Handler as the only NestJS caller; cookie-based sessions are the natural match. (2) **Smaller blast radius.** A ~50-LOC session helper is grep-friendly, debuggable, and test-friendly. (3) **Compatibility with Next.js 16 / React 19.** Built-in `next/headers` `cookies()` is the canonical primitive.
**Libraries:** —

### phase-02-auth-frontend/TD-02

**Recommendation:** Three reasons. (1) **Defense in depth on the cookie content** — `httpOnly` blocks JS, encryption blocks accidental log/proxy inspection. (2) **Single cookie to manage** simplifies logout. (3) **Room to carry minimal user metadata** (`userId`, `email`, `channelSlug`).
**Libraries:** iron-session

### phase-02-auth-frontend/TD-03

**Recommendation:** The single-flight detail is non-trivial and goes in the helper from day one — tested by MSW with a "two concurrent intercepted upstream calls; one refresh expected" assertion.
**Libraries:** —

### phase-02-auth-frontend/TD-04

**Recommendation:** Three reasons. (1) **Decoupled from TD-05** — works with Route Handlers OR Server Actions. (2) **Aligned with shadcn's canonical form primitive.** (3) **Zod-first developer ergonomics match the rest of the FE foundation.**
**Libraries:** react-hook-form, @hookform/resolvers

### phase-02-auth-frontend/TD-05

**Recommendation:** Three reasons. (1) **Strict-BFF alignment.** (2) **Test scaffold already exists.** (3) **Single mutation surface** for Phases 03–07.
**Libraries:** —

### phase-02-auth-frontend/TD-06

**Recommendation:** Two reinforcing reasons. (1) **No first-render flicker, no round-trip.** (2) **No new BFF endpoint.**
**Libraries:** —

### phase-02-auth-frontend/TD-07

**Recommendation:** Three reasons. (1) **First-paint-correct.** (2) **Single integration pattern across both flows.** (3) **Email-prefetch behavior** is solved at the backend's idempotent-confirmation level.
**Libraries:** —

### openapi-docs-nestjs/TD-01

**Recommendation:** Option A (`@nestjs/swagger`) — preserves class-validator decisions without re-platform. CLI plugin with `classValidatorShim: true` reuses existing `class-validator` decorators to infer schemas.
**Libraries:** @nestjs/swagger

### openapi-docs-nestjs/TD-02

**Recommendation:** Option C (Both) — marginal cost is one npm script (~15 lines); benefit is correct foundation for future FE codegen without losing the interactive UI.
**Libraries:** —

### openapi-docs-nestjs/TD-03

**Recommendation:** Option B (Dev/staging only) — aligns with defensive posture from phase 02.
**Libraries:** —

### next-frontend-config-base/TD-01

**Recommendation:** Option A (Zod 4) — Type-inference matches the FE's strict-TS culture; ecosystem gravity in Next.js/React 19; direct enablement of TD-02.
**Libraries:** zod

### next-frontend-config-base/TD-02

**Recommendation:** Option A (`@t3-oss/env-nextjs`) — combines type-level `NEXT_PUBLIC_` prefix enforcement, runtime Proxy-based leak detection, and single-file consumer ergonomics.
**Libraries:** @t3-oss/env-nextjs

### next-frontend-config-base/TD-03

**Recommendation:** Option A (Strict BFF — single server-only `API_URL`) — eliminates CORS, eliminates public exposure of the backend URL, and produces the smallest correct foundation.
**Libraries:** —

### next-frontend-openapi-typing/TD-01

**Recommendation:** Option A (`openapi-typescript` + `openapi-fetch`) — Types-first matches the rest of the FE foundation; MSW typing solved by the same `paths` symbol.
**Libraries:** openapi-typescript, openapi-fetch

### next-frontend-openapi-typing/TD-02

**Recommendation:** Option B (committed local copy + repo-root sync script) — preserves compose-stack independence; drift eliminated structurally with CI freshness check.
**Libraries:** —

### next-frontend-openapi-typing/TD-03

**Recommendation:** Option C (committed + CI freshness check) — makes contract drift both visible and impossible to merge accidentally.
**Libraries:** —

### next-frontend-openapi-typing/TD-04

**Recommendation:** Option A (single `lib/api/contracts.ts` with explicit aliases) — single grep target for "what shape does the BFF expose".
**Libraries:** —

### next-frontend-openapi-typing/TD-05

**Recommendation:** Option A (hand-written, typed via `paths`) — determinism over auto-generation; coherence with TD-01 recommendation.
**Libraries:** —

### next-frontend-msw-foundation/TD-01

**Recommendation:** Option B (per-domain modules + barrel) — domain ownership tracks the codebase; append-only growth with minimal merge conflicts.
**Libraries:** —

### next-frontend-msw-foundation/TD-02

**Recommendation:** Option A (test-only, `setupServer` only at the foundation) — keeps the foundation minimal, aligns 1:1 with everything documented.
**Libraries:** —

### next-frontend-msw-foundation/TD-03

**Recommendation:** Option D (hand-written defaults as the default + opt-in seeded faker for bulk collections) — determinism + readability as the right baseline.
**Libraries:** —

### next-frontend-msw-foundation/TD-04

**Recommendation:** Option A (universal handler set + `server.use(...)` overrides + `onUnhandledRequest: "error"`) — loads all handlers with no cost on tests that don't fetch extra URLs.
**Libraries:** —

## Inherited Conventions

- Backend config uses `@nestjs/config` with namespaced `registerAs(name, () => ({...}))` factories — one file per domain in `src/config/`. _(from phase 01)_
- Env variables are validated by a Joi schema in `src/config/env.validation.ts`, passed to `ConfigModule.forRoot({ validationSchema, validationOptions: { allowUnknown: true, abortEarly: false } })`. _(from phase 01)_
- Config is injected into modules via `ConfigType<typeof xxxConfig>` and `@Inject(xxxConfig.KEY)`; the same factory is importable as a plain function for non-DI contexts (e.g., TypeORM CLI). _(from phase 01)_
- `data-source.ts` loads `.env` via `import 'dotenv/config'` at the top, then imports `databaseConfig` and calls it as a plain function. _(from phase 01)_
- Database connection parameters (host, port, etc.) are sourced from a single `databaseConfig` factory — never duplicated between `AppModule` and `data-source.ts`. _(from phase 01)_
- `TypeOrmModule.forRootAsync` is used (not `forRoot`), with `imports: [ConfigModule]`, `inject: [databaseConfig.KEY]`, `useFactory` returning options including `autoLoadEntities: true`, `synchronize: false`. _(from phase 01)_
- Strict BFF model: Route Handlers under `app/api/**` are the only NestJS caller; browser never calls Nest directly. _(from phase 02 frontend)_
- Session management via `iron-session` encrypted cookie carrying `{ accessToken, refreshToken, userId, email }`. _(from phase 02 frontend)_
- Transparent BFF refresh on upstream 401 with per-request single-flight. _(from phase 02 frontend)_
- `react-hook-form` + `@hookform/resolvers/zod` for forms. _(from phase 02 frontend)_
- Route Handler POST + client `fetch` for mutations. _(from phase 02 frontend)_
- Server-rendered session + React Context Provider in RSC layout. _(from phase 02 frontend)_
- MSW per-domain handlers barrel; universal handler set + `server.use()` overrides; `onUnhandledRequest: "error"`. _(from phase 02 frontend)_
- OpenAPI contract chain: `openapi.json` → `types.gen.ts` → `paths` → consumers + MSW. _(from phase 02 frontend)_

## Inherited Deferred Capabilities

_No inherited deferred capabilities._

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
| Guard (simple, delegates to Passport) | E2E only |
| Pipe (custom transformation) | Unit |
| Interceptor (response transform, logging) | Unit and/or E2E |
| Exception Filter | Unit + E2E |
| Middleware | E2E |

### next-frontend

| Artifact type | Required layers |
|---------------|-----------------|
| Page — sync RSC, no interaction | None at component level; cover only if critical flow → `*.e2e-spec.ts` |
| Page — sync RSC composing client children | Test client children directly; cover rendered page via `*.e2e-spec.ts` |
| Page — async RSC (`async function Page()` with `await fetch`) | `*.e2e-spec.ts` only |
| Layout (`layout.tsx`) | None unless it adds logic; else via E2E |
| Client component (`"use client"`) with state/handlers | `*.test.ts` — RTL + jsdom, mock `next/navigation` and `fetch` |
| Feature component (server, composes primitives) | Skip unit; cover via E2E |
| shadcn UI primitive (`components/ui/*`) | None |
| Icon (`components/icons/*`) | None |
| `lib/` utility with branching | `*.test.ts` |
| Custom hook (`hooks/*`) | `*.test.ts` with `renderHook` |
| Route handler with branching | `*.test.ts` (pure logic) and/or `*.integration.test.ts` with MSW |
| Route handler (simple proxy) | `*.integration.test.ts` with MSW only |
| Server action | `*.integration.test.ts` with MSW; E2E for submit flow |