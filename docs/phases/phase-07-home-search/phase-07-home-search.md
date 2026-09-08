---
kind: phase
name: phase-07-home-search
test_specs_aware: true
sources_mtime:
  docs/phases/phase-07-home-search/context.md: "2026-09-08 07:59:34.547264086 -0300"
  docs/decisions/technical-decisions-home-search.md: "2026-09-08 07:59:34.547264086 -0300"
  docs/phases/phase-05-watch-page/context.md: "2026-09-02 21:55:39.044449606 -0300"
  docs/phases/phase-06-social/context.md: "2026-09-02 22:42:24.343285127 -0300"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-08-31 22:18:23.772557281 -0300"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-08-31 22:18:23.773628364 -0300"
---

# Phase 07 — Página Inicial, Busca e Finalização

## Objective

Deliver the final platform layer — home page with video grid and category filter, search by title/channel, shared navbar, responsive layout, production Docker Compose configuration, and end-to-end testing.

---

## Step Implementations

### SI-07.1 — Home Page Video Listing Endpoint + Search Endpoint

**Description:** Create the public home page video listing endpoint with cursor pagination and category filter, and the search endpoint using ILIKE.

**Technical actions:**

- Add to `VideosService`:
  ```typescript
  async findHomeVideos(cursor?: string, limit = 20, categoryId?: number) {
    const qb = this.videoRepository.createQueryBuilder('v')
      .leftJoinAndSelect('v.channel', 'channel')
      .where('v.status = :status', { status: 'ready' })
      .andWhere('v.published_at IS NOT NULL')
      .andWhere('v.visibility = :vis', { vis: 'public' })
      .orderBy('v.published_at', 'DESC')
      .take(limit + 1);
    if (categoryId) qb.andWhere('v.category_id = :catId', { catId: categoryId });
    if (cursor) qb.andWhere('v.id < :cursor', { cursor });
    const videos = await qb.getMany();
    return { videos: videos.slice(0, limit), nextCursor: videos.length > limit ? videos[limit - 1].id : null };
  }

  async search(query: string, cursor?: string, limit = 20) {
    const qb = this.videoRepository.createQueryBuilder('v')
      .leftJoinAndSelect('v.channel', 'channel')
      .where('v.status = :status', { status: 'ready' })
      .andWhere('v.published_at IS NOT NULL')
      .andWhere('v.visibility = :vis', { vis: 'public' })
      .andWhere('(v.title ILIKE :query OR channel.name ILIKE :query)', { query: `%${query}%` })
      .orderBy('v.published_at', 'DESC')
      .take(limit + 1);
    if (cursor) qb.andWhere('v.id < :cursor', { cursor });
    const videos = await qb.getMany();
    return { videos: videos.slice(0, limit), nextCursor: videos.length > limit ? videos[limit - 1].id : null };
  }
  ```
- Add to `VideosController`:
  - `GET /api/videos/home` — public, accepts `categoryId`, `cursor`, `limit`
  - `GET /api/videos/search` — public, accepts `q` (query), `cursor`, `limit`
- Add `pg_trgm` extension migration: `CREATE EXTENSION IF NOT EXISTS pg_trgm` + `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_title_trgm ON videos USING GIN (title gin_trgm_ops)`

**TD references:** home-search/TD-01 (ILIKE + pg_trgm), home-search/TD-02 (dedicated endpoint)

**Acceptance criteria:**
- `GET /api/videos/home` returns paginated, public, published videos
- `GET /api/videos/home?categoryId=1` filters by category
- `GET /api/videos/search?q=test` returns matching videos by title and channel name
- Search is case-insensitive
- Cursor pagination works on both endpoints

---

### SI-07.2 — Navbar Component (RSC + Shared Layout)

**Description:** Create the navbar with logo, search bar, login/avatar button, and navigation links. Integrate into the root layout.

**Technical actions:**

- Create `next-frontend/components/layout/header.tsx`:
  - RSC — reads session server-side
  - Logo linking to `/`
  - Search form: `<form action="/search" method="GET">` with `<input name="q">`
  - If logged in: user avatar (initials), link to `/dashboard`, logout link
  - If not logged in: "Sign In" link to `/login`
  - Mobile: hamburger menu (client component for toggle)
- Create `next-frontend/components/layout/mobile-menu.tsx`:
  - `"use client"` — toggle mobile nav visibility
- Modify `next-frontend/app/layout.tsx`:
  - Import and render `<Header />` at the top
  - Add responsive container classes
- Add MSW handlers for any new endpoints

**TD reference:** home-search/TD-03 (Shared RSC layout)

**Acceptance criteria:**
- Navbar appears on all pages
- Logo links to home
- Search form navigates to /search?q=...
- Login button shows for unauthenticated users
- Avatar + dashboard link + logout show for authenticated users
- Mobile menu works on small screens

---

### SI-07.3 — Home Page with Video Grid and Category Filter

**Description:** Create the home page at `/` with a grid of video cards, category filter chips, and pagination.

**Technical actions:**

- Modify `next-frontend/app/page.tsx`:
  - RSC fetches `GET /api/videos/home` with optional `categoryId` and `cursor`
  - Fetches categories from `GET /api/categories`
  - Renders category filter chips (links to `/?categoryId=N`)
  - Renders video grid (4-column desktop, 2-column tablet, 1-column mobile)
  - Renders "Next" button for pagination
- Create `next-frontend/components/video/video-card.tsx`:
  - Server component — renders thumbnail, title, channel name, views, publish time
  - Links to `/watch/[id]`
  - Responsive sizing
- Update MSW handlers for home endpoint

**TD reference:** home-search/TD-02 (dedicated endpoint)

**Acceptance criteria:**
- Home page shows grid of published, public videos
- Category chips filter by category
- Grid is responsive (4 → 2 → 1 columns)
- Pagination works via cursor
- Each card shows thumbnail, title, channel name, views
- Clicking a card navigates to `/watch/[id]`

---

### SI-07.4 — Search Results Page

**Description:** Create the search page at `/search` that displays results from the search endpoint.

**Technical actions:**

- Create `next-frontend/app/search/page.tsx`:
  - RSC reads `searchParams.q` (query)
  - Fetches `GET /api/videos/search?q=...`
  - Shows "Results for: {query}" header
  - Renders same video card grid as home page
  - Pagination via cursor
  - Empty state: "No videos found for '{query}'"
- Create BFF route handler `next-frontend/app/api/videos/search/route.ts`:
  - `GET` — proxies to NestJS, forwards query params
- Update MSW handlers

**TD reference:** home-search/TD-01 (ILIKE search)

**Acceptance criteria:**
- `/search?q=test` shows matching videos
- Empty query returns recent videos
- No results shows empty state message
- Pagination works
- Cards link to `/watch/[id]`

---

### SI-07.5 — Production Docker Compose Configuration

**Description:** Create production-ready Docker Compose with multi-stage builds, persistent volumes, and Caddy reverse proxy with TLS.

**Technical actions:**

- Create `Dockerfile` (multi-stage build for NestJS):
  ```dockerfile
  FROM node:25-slim AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM node:25-slim
  WORKDIR /app
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/package.json ./
  EXPOSE 3000
  CMD ["node", "dist/main"]
  ```
- Create `Dockerfile` (multi-stage for Next.js):
  ```dockerfile
  FROM node:22-slim AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM node:22-slim
  WORKDIR /app
  COPY --from=builder /app/.next ./.next
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/package.json ./
  COPY --from=builder /app/public ./public
  EXPOSE 3000
  CMD ["node", ".next/standalone/server.js"]
  ```
- Create `docker-compose.prod.yml` (or `compose.prod.yaml`):
  - Caddy service (reverse proxy + TLS via Let's Encrypt)
  - NestJS API (production build, no watch mode)
  - Next.js frontend (production build)
  - PostgreSQL 17 with persistent volume
  - Redis 7 with persistent volume
  - MinIO with persistent volume
  - Mailpit
  - Environment file for secrets
- Add healthchecks for production services
- Add `.env.prod.example` documenting all production env vars

**TD reference:** home-search/TD-04 (Docker Compose production profile)

**Acceptance criteria:**
- `docker compose -f compose.prod.yaml up -d` starts all services
- Caddy serves frontend at port 443 with TLS
- API is not publicly exposed (Caddy proxies `/api/*` to NestJS)
- All data persists across restarts (volumes)
- Services start without errors

---

## Technical Specifications

### API Contracts

**Backend Tier (NestJS)**

| Method | Path | Auth | Description | Status | Body / Response |
|--------|------|------|-------------|--------|-----------------|
| `GET` | `/api/videos/home` | Public | Home page videos | 200 | `{ videos, nextCursor }` |
| `GET` | `/api/videos/search` | Public | Search videos | 200 | `{ videos, nextCursor }` |

**BFF Tier (Next.js)**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/videos/home` | Proxy to NestJS GET /api/videos/home |
| `GET` | `/api/videos/search` | Proxy to NestJS GET /api/videos/search |

## Dependency Map

| SI | Dependencies | Depends on |
|----|-------------|------------|
| SI-07.1 | Phase 05 + 06 | Video entity, VideosService |
| SI-07.2 | Phase 02 (auth/session) | Session module |
| SI-07.3 | SI-07.1 (home endpoint) | SI-07.1 |
| SI-07.4 | SI-07.1 (search endpoint) | SI-07.1 |
| SI-07.5 | All phases | Complete app |

## Deliverables

**Commands:**
```bash
docker compose exec nestjs-api npm run migration:run
docker compose exec nestjs-api npm test -- --runInBand
docker compose exec next-frontend npm test
docker compose exec nestjs-api npx tsc --noEmit
docker compose exec next-frontend npx tsc --noEmit
```

**Verification steps:**
1. Navigate to `/` — home page shows video grid
2. Click a category chip — grid filters by category
3. Type in search bar, submit — results page shows matching videos
4. Navbar shows on all pages with correct login state
5. Resize browser — layout adapts (4→2→1 columns)
6. `docker compose -f compose.prod.yaml up` starts all services
7. Full test suite passes