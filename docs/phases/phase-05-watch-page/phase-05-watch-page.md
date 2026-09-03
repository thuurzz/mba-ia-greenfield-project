---
kind: phase
name: phase-05-watch-page
test_specs_aware: true
sources_mtime:
  docs/phases/phase-05-watch-page/context.md: "2026-09-02 21:54:18.150572096 -0300"
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

# Phase 05 — Página de Visualização do Vídeo

## Objective

Deliver the video watch page with HLS player, view counting with IP-based 24h deduplication, same-category suggested videos sidebar, expandable description, anonymous access, download button, and unlisted video visibility enforcement.

---

## Step Implementations

### SI-05.1 — Video Views Entity, Migration, and View Tracking Endpoint

**Description:** Create the `video_views` table for IP-based deduplication (24h window), the view increment endpoint, and cleanup logic.

**Technical actions:**

- Create `src/videos/video-view.entity.ts`:
  - `id: number` — PK auto-increment
  - `videoId: string` — FK to videos, NOT NULL
  - `ip: string` — varchar(45), NOT NULL
  - `viewedAt: Date` — timestamp, default now()
  - Index on `(video_id, ip, viewed_at)`
- Generate migration: `npm run typeorm -- migration:generate -d src/database/data-source.ts src/database/migrations/CreateVideoViews`
- Add to `VideosService`:
  ```typescript
  async recordView(videoId: string, ip: string): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await this.videoViewRepository.findOne({
      where: { videoId, ip, viewedAt: MoreThan(since) },
    });
    if (existing) return;
    await this.videoViewRepository.insert({ videoId, ip });
    await this.videoRepository.increment({ id: videoId }, 'viewCount', 1);
  }
  ```
- Add to `VideosController`:
  ```typescript
  @Public()
  @Post(':id/view')
  async recordView(@Param('id') id: string, @Req() req: Request) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    await this.videosService.recordView(id, ip);
    return { success: true };
  }
  ```
- Register `VideoView` entity in TypeOrmModule.forFeature

**TD reference:** watch-page/TD-01 (IP + 24h window)

**Acceptance criteria:**
- `POST /api/videos/:id/view` increments viewCount on first request from IP
- Same IP viewing again within 24h does NOT increment
- Different IPs viewing the same video each increment viewCount
- Integration test verifies dedup behavior

---

### SI-05.2 — Suggested Videos Endpoint

**Description:** Create the suggested videos endpoint that returns videos from the same category (with fallback to recent videos from other categories).

**Technical actions:**

- Add to `VideosService`:
  ```typescript
  async findSuggested(videoId: string, categoryId: number | null, limit = 12) {
    if (!categoryId) {
      return this.videoRepository.find({
        where: { status: 'ready', publishedAt: Not(IsNull()), visibility: 'public' },
        order: { publishedAt: 'DESC' },
        take: limit,
      });
    }
    const sameCategory = await this.videoRepository.find({
      where: { categoryId, status: 'ready', publishedAt: Not(IsNull()), visibility: 'public' },
      order: { publishedAt: 'DESC' },
      take: limit,
    });
    const filtered = sameCategory.filter(v => v.id !== videoId);
    if (filtered.length >= 6) return filtered.slice(0, limit);
    const needed = limit - filtered.length;
    const fallback = await this.videoRepository.find({
      where: { status: 'ready', publishedAt: Not(IsNull()), visibility: 'public' },
      order: { publishedAt: 'DESC' },
      take: needed + 1,
    });
    const excludedIds = new Set([videoId, ...filtered.map(v => v.id)]);
    const fallbackFiltered = fallback.filter(v => !excludedIds.has(v.id)).slice(0, needed);
    return [...filtered, ...fallbackFiltered];
  }
  ```
- Add to `VideosController`:
  ```typescript
  @Public()
  @Get(':id/suggested')
  async findSuggested(@Param('id') id: string) {
    const video = await this.videosService.findById(id);
    if (!video) throw new NotFoundException('VIDEO_NOT_FOUND');
    return this.videosService.findSuggested(id, video.categoryId);
  }
  ```

**TD reference:** watch-page/TD-02 (Same category + fallback)

**Acceptance criteria:**
- Returns videos from same category when available
- Falls back to recent videos from other categories when same-category is sparse
- Excludes the current video
- Only returns public, published, ready videos
- Integration test verifies fallback behavior

---

### SI-05.3 — Unlisted Visibility Enforcement on List Queries

**Description:** Add `WHERE visibility = 'public'` to all list queries (channel page, dashboard, suggested) to enforce unlisted video access.

**Technical actions:**

- Update `VideosService.findByChannelPublic` — add `andWhere('v.visibility = :vis', { vis: 'public' })`
- Update `VideosService.findSuggested` — already has `visibility: 'public'` in TD-05.2
- Verify `GET /api/videos/:id` (single video) returns regardless of visibility (anyone with link can view)
- Verify `GET /api/videos` (dashboard list, authenticated) returns all videos owned by user regardless of visibility

**TD reference:** watch-page/TD-03 (Backend filter + ULID entropy)

**Acceptance criteria:**
- Channel public page does not show unlisted videos
- Suggested videos endpoint does not return unlisted videos
- Single video endpoint returns unlisted videos (anyone with link)
- Dashboard list shows all videos regardless of visibility

---

### SI-05.4 — Watch Page Frontend (RSC + Client Components)

**Description:** Create the watch page at `/watch/[id]` with HLS player, video info, expandable description, suggested videos sidebar, and download button.

**Technical actions:**

- Create `next-frontend/app/watch/[id]/page.tsx`:
  - RSC fetches video metadata + suggested videos server-side
  - Renders layout: main video area (left) + sidebar with suggestions (right)
  - Passes video data to client components
- Create `next-frontend/components/video/video-info.tsx`:
  - Title, view count, publish date, channel name, download button
  - Download button calls `GET /api/videos/:id/download` (BFF proxy)
- Create `next-frontend/components/video/description-expand.tsx`:
  - `"use client"` — toggle show more/less for long descriptions
  - Shows first 2 lines by default, expand button for longer text
- Create `next-frontend/components/video/suggested-videos.tsx`:
  - Grid/list of video cards (thumbnail, title, channel name, views)
  - Each card links to `/watch/[id]`
- Create BFF route handler `next-frontend/app/api/videos/[id]/view/route.ts`:
  - `POST` — proxies view tracking to NestJS
- Create BFF route handler `next-frontend/app/api/videos/[id]/suggested/route.ts`:
  - `GET` — proxies suggested videos to NestJS
- Integrate `HlsPlayer` from Phase 03 into the watch page
- Update MSW handlers for view and suggested endpoints
- Create integration test for watch page BFF routes

**TD references:** watch-page/TD-04 (RSC + client components), watch-page/TD-03 (unlisted access)

**Acceptance criteria:**
- Watch page renders at `/watch/[id]` with HLS player
- Video metadata (title, views, channel) displays correctly
- Description expands/collapses on click
- Suggested videos sidebar shows related content
- Download button links to download endpoint
- Anonymous users can view the page
- Unlisted videos are accessible via direct link

---

## Technical Specifications

### Data Model

**VideoView Entity** (`video_views` table)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | integer | PK, auto-increment | View ID |
| `video_id` | varchar(26) | FK → videos, NOT NULL | Video viewed |
| `ip` | varchar(45) | NOT NULL | Viewer IP address |
| `viewed_at` | timestamp | NOT NULL, default now() | When viewed |

Index: `(video_id, ip, viewed_at)` for dedup queries.

### API Contracts

**Backend Tier (NestJS)**

| Method | Path | Auth | Description | Status | Body / Response |
|--------|------|------|-------------|--------|-----------------|
| `POST` | `/api/videos/:id/view` | Public | Record view (IP dedup) | 200 | `{ success: true }` |
| `GET` | `/api/videos/:id/suggested` | Public | Get suggested videos | 200 | `[Video, ...]` |
| `GET` | `/api/videos/:id` | Public | Get video metadata | 200 | Video object |

**BFF Tier (Next.js)**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/videos/[id]/view` | Proxy to NestJS POST /api/videos/:id/view |
| `GET` | `/api/videos/[id]/suggested` | Proxy to NestJS GET /api/videos/:id/suggested |

### Authorization Matrix

| Resource | Action | Role | Condition |
|----------|--------|------|-----------|
| View count | Increment | Anonymous | Any IP, deduped within 24h |
| Video metadata | Read | Anonymous | `status = 'ready'` AND (`visibility = 'public'` OR direct link) |
| Suggested videos | Read | Anonymous | Only `visibility = 'public'` |
| Download | Access | Channel owner | Same as Phase 03 |

### Error Catalog

| Error code | HTTP status | Description |
|------------|-------------|-------------|
| `VIDEO_NOT_FOUND` | 404 | Video ID does not exist |
| `VIDEO_NOT_READY` | 400 | Video is still processing |

## Dependency Map

| SI | Dependencies | Depends on |
|----|-------------|------------|
| SI-05.1 | Phase 03 + 04 infrastructure | Video entity, VideosService |
| SI-05.2 | SI-05.1 (VideosService extended) | SI-05.1 |
| SI-05.3 | SI-05.2 (query methods exist) | SI-05.2 |
| SI-05.4 | SI-05.1 (view endpoint), SI-05.2 (suggested endpoint), SI-05.3 (visibility) | SI-05.1, SI-05.2, SI-05.3 |

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
1. Navigate to `/watch/{videoId}` — player loads, video plays
2. View count increments on first visit (different IP)
3. Same IP refresh does not increment view count
4. Suggested videos appear in sidebar based on same category
5. Description expands/collapses on click
6. Download button triggers download
7. Unlisted video accessible via direct link but not in channel page
8. Anonymous users can view the page