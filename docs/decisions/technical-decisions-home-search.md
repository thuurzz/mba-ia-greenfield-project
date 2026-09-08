---
scope_type: phase
related_phases: [7]
status: decided
date: 2026-09-02
scope_description: "Home page, search, navbar, responsive layout, production deployment for Phase 07 — Finalização"
---

# Technical Decisions — Phase 07: Página Inicial, Busca e Finalização

_Subprojects in scope:_

- `nestjs-project/` — search endpoint, home page video listing endpoint (public, paginated, categorized), production Docker config
- `next-frontend/` — home page, navbar, search page, responsive layout, production build config

---

## TD-01: Search Implementation Strategy

**Scope:** Backend

**Capability:** Barra de busca (pesquisa por título e canal)

**Context:** Users must be able to search videos by title and channel name. The search must be fast and support partial matches. The choice is between a simple SQL query and PostgreSQL full-text search.

**Options:**

### Option A: PostgreSQL ILIKE + GIN trigram index
- `SELECT * FROM videos WHERE title ILIKE '%query%'` with a `pg_trgm` GIN index on `title`. Same for channel name via JOIN.
- **Pros:** Simple. No external dependency. `pg_trgm` extension is already available. Fast with index. Partial matching works.
- **Cons:** No relevance ranking. No typo tolerance. No stemming.

### Option B: PostgreSQL full-text search (tsvector)
- Create a `tsvector` column combining video title + channel name. Use `to_tsvector('english', title) @@ to_tsquery('english', 'query')`.
- **Pros:** Relevance ranking. Stemming. Stop word handling. Native PostgreSQL feature.
- **Cons:** More complex setup (tsvector column, trigger, index). English-only stemming. No typo tolerance.

### Option C: External search service (Meilisearch / Typesense)
- Third-party search engine running in Docker. Provides typo-tolerant, faceted search out of the box.
- **Pros:** Best search UX. Typo tolerance. Instant results. Faceted filtering. Admin UI.
- **Cons:** New Docker service. Data sync. Overhead for an MVP.

**Recommendation:** **Option A (ILIKE + pg_trgm index)** — Simplest approach for an MVP. `pg_trgm` index makes ILIKE queries fast even on large datasets. No new infrastructure. Can be upgraded to full-text search later.

**Decision:** A (ILIKE + pg_trgm index)

---

## TD-02: Home Page Data Source

**Scope:** Backend

**Capability:** Página inicial com grid de vídeos (thumbnail, título, canal, visualizações e tempo de publicação)

**Context:** The home page needs a list of published, public videos. This is a public endpoint (no auth required). Must support pagination and category filtering.

**Options:**

### Option A: Dedicated endpoint — reuse existing query pattern
- `GET /api/videos/home?categoryId=&cursor=&limit=` — returns paginated, published, public videos. Reuses `findByChannelPublic` logic but without channel filter.
- **Pros:** Consistent with existing cursor pagination pattern. Simple query.
- **Cons:** One more endpoint (but trivial).

### Option B: Reuse existing channel endpoint
- No dedicated endpoint. Frontend calls `GET /api/videos/channel/:nickname` for each channel or aggregates from multiple calls.
- **Pros:** Zero new backend code.
- **Cons:** Cannot show cross-channel videos on home. Multiple network calls. Bad UX.

**Recommendation:** **Option A (Dedicated endpoint)** — Single endpoint, consistent with existing patterns, supports pagination and category filter out of the box.

**Decision:** A (Dedicated endpoint)

---

## TD-03: Navbar Architecture

**Scope:** Frontend

**Capability:** Header/navbar com logo, barra de busca, botão de login/avatar e navegação

**Context:** The navbar appears on every page. It must show the logo, search bar, login button (or user avatar when authenticated), and navigation links. The architecture choice affects layout structure and session handling.

**Options:**

### Option A: Shared RSC layout component
- Navbar is a Server Component in `app/layout.tsx` or a shared component rendered by the root layout. It reads the session server-side to decide login vs avatar. Client hydration only for interactive parts (search dropdown, mobile menu toggle).
- **Pros:** Server-rendered, fast. Session-aware with zero client fetch. SEO-friendly. Single source of truth.
- **Cons:** Search bar submission requires client JS (form action or client component for the input).

### Option B: Client component with session fetch
- Navbar is a Client Component that fetches `/api/auth/me` on mount to determine login state. Search is a form or controlled input.
- **Pros:** Client-side interactivity is trivial. No RSC/client boundary issues.
- **Cons:** Flash of "not logged in" before client fetch resolves. Extra round-trip. Loses RSC personalization.

**Recommendation:** **Option A (Shared RSC layout)** — Consistent with the existing pattern (Phase 02 used RSC layout for session). Logo and login/avatar are server-rendered. Search bar is a form that navigates to `/search?q=:query`. Mobile menu toggle is a small client component.

**Decision:** A (Shared RSC layout component)

---

## TD-04: Production Deployment Strategy

**Scope:** Repo-wide

**Capability:** Ambiente de produção e deploy

**Context:** The project needs to be deployable to production. Currently all services run via Docker Compose in development mode. Production requires optimized builds, persistent volumes, proper secrets management, and possibly a reverse proxy.

**Options:**

### Option A: Docker Compose production profile
- Add a `production` profile to `compose.yaml` with production-ready images (multi-stage builds), persistent volumes for DB/MinIO/Redis, environment file for secrets, and a reverse proxy (Caddy/Nginx) for TLS and routing.
- **Pros:** Same compose file. No new tooling. Portable. Simple to understand. Works on any VPS.
- **Cons:** Manual deployment (no CI/CD pipeline). Requires VPS or similar.

### Option B: Fly.io / Railway / Render deployment
- Deploy to a PaaS. Each service as a separate app. Managed PostgreSQL, Redis. No Docker Compose in prod.
- **Pros:** Managed infrastructure. Less ops work. Built-in CI/CD from GitHub.
- **Cons:** Vendor lock-in. Cost scales. Different configs per service. Network latency between services.

### Option C: Kubernetes (k8s)
- Full Kubernetes deployment with Helm charts or kustomize.
- **Pros:** Industry standard. Scalable. Self-healing.
- **Cons:** Massive overkill for an MVP. Steep learning curve. Infrastructure cost.

**Recommendation:** **Option A (Docker Compose production profile)** — Simplest path to production. A single VPS ($10-20/month) runs everything. Multi-stage builds produce small images. Caddy handles TLS automatically. Production profile in compose.yaml keeps dev and prod configs together.

**Decision:** A (Docker Compose production profile)

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|----------------|--------|
| TD-01 | Backend | Search Implementation | **A** (ILIKE + pg_trgm index) | **A** |
| TD-02 | Backend | Home Page Data Source | **A** (Dedicated endpoint) | **A** |
| TD-03 | Frontend | Navbar Architecture | **A** (Shared RSC layout) | **A** |
| TD-04 | Repo-wide | Production Deployment | **A** (Docker Compose production profile) | **A** |

## New Dependencies

None — all packages already installed.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/videos/videos.controller.ts` | Modify | Add home listing + search endpoints |
| `src/videos/videos.service.ts` | Modify | Add findHomeVideos, search methods |
| `next-frontend/app/page.tsx` | Modify | Home page with video grid + category filter |
| `next-frontend/components/layout/header.tsx` | Create | Navbar with logo, search, login/avatar |
| `next-frontend/app/search/page.tsx` | Create | Search results page |
| `next-frontend/components/video/video-card.tsx` | Create | Video card component for grids |
| `next-frontend/app/layout.tsx` | Modify | Add navbar to root layout |
| `next-frontend/mocks/handlers/home.ts` | Create | MSW handlers |
| `compose.yaml` (root) | Create | Production Docker Compose |