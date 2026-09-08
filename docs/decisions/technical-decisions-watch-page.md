---
scope_type: phase
related_phases: [5]
status: decided
date: 2026-09-01
scope_description: "Video watch page with player, view counting, suggested videos, description expand/collapse, download, and unlisted video access for Phase 05"
---

# Technical Decisions — Phase 05: Página de Visualização do Vídeo

_Subprojects in scope:_

- `nestjs-project/` — view count increment endpoint, suggested videos query, unlisted token validation, video metadata endpoint
- `next-frontend/` — watch page layout, HLS player integration, description expand/collapse, suggested videos sidebar, download button, unlisted access page

---

## TD-01: View Counting Strategy

**Scope:** Backend

**Capability:** Contagem de visualizações

**Context:** The Video entity has a `viewCount` field. Counting views on a video platform is notoriously tricky — a page refresh, the uploader watching their own video, or bots can inflate counts. The choice is how to increment views accurately without overcounting.

**Options:**

### Option A: Increment on every page load (naive)
- `GET /api/videos/:id` increments `viewCount` by 1 on every request. No deduplication.
- **Pros:** Simplest implementation. No additional infrastructure.
- **Cons:** Page refreshes, bots, and pre-fetching inflate counts. Uploader watching their own video counts as a view. Not accurate.

### Option B: Increment with IP + video deduplication (24h window)
- On `GET /api/videos/:id`, check if the requesting IP has viewed this video in the last 24 hours (stored in a `video_views` table with `video_id`, `ip`, `viewed_at`). If not, increment and insert a row.
- **Pros:** More accurate — same IP does not count multiple views within 24h. No Redis needed — PostgreSQL suffices. Handles refreshes.
- **Cons:** Requires a new table and cleanup job. IP-based dedup is not perfect (NAT, shared IPs). Anonymous users work (IP is available). Authenticated users still get one view per IP per 24h.

### Option C: Debounced frontend + backend dedup (session-based)
- Frontend fires `POST /api/videos/:id/view` after the user has watched ≥30 seconds or 50% of the video (whichever comes first). Backend deduplicates using a `(video_id, user_id_or_session)` pair with a 24h window. Anonymous users get a session cookie.
- **Pros:** Most accurate — only counts when user actually watched. No bot inflation. Resists refreshes.
- **Cons:** Requires client-side timer logic. Session tracking for anonymous users needs a cookie. More complex than IP-based.

**Recommendation:** **Option B (IP + 24h window)** — Best balance of accuracy and simplicity. The `video_views` table is a single migration. A cleanup job deletes rows older than 24h (or use a TTL index). IP-based dedup is the YouTube standard for MVP accuracy. Option C is ideal but overengineering for an MVP — the 30-second watch threshold adds client complexity without proportional benefit.

**Decision:** B (IP + 24h window)

---

## TD-02: Suggested Videos Query Strategy

**Scope:** Backend

**Capability:** Sugestões de vídeos da mesma categoria na sidebar

**Context:** The watch page sidebar shows suggested videos. The simplest approach is to show videos from the same category. The Video entity has `categoryId` (nullable) and `publishedAt`. The query must exclude the current video and only return public, published videos.

**Options:**

### Option A: Same category, ordered by published_at DESC
- `SELECT * FROM videos WHERE category_id = :catId AND id != :currentId AND status = 'ready' AND published_at IS NOT NULL AND visibility = 'public' ORDER BY published_at DESC LIMIT 12`
- **Pros:** Simple, single query. Returns most recent relevant videos. Index on `(category_id, published_at)` makes it fast.
- **Cons:** If category has few videos, suggestions may be sparse. No variety — all from same category.

### Option B: Same category + random fallback
- Try to fetch 12 videos from same category. If fewer than 6, supplement with recent videos from other categories (excluding current). Order by `published_at DESC` for the fallback.
- **Pros:** Always returns 12 suggestions. More variety when category is sparse.
- **Cons:** Slightly more complex query. Mixed categories may feel less relevant.

### Option C: Trending across all categories
- Return most-viewed published videos across all categories (excluding current), ordered by `view_count DESC`.
- **Pros:** Shows popular content. No dependency on category being set.
- **Cons:** Not contextual to the current video. May show unrelated content.

**Recommendation:** **Option B (Same category + random fallback)** — Best UX for an MVP. Videos in the same category are most relevant. If the category is sparse, supplement with recent videos. The query is two simple SQL queries, no complex ranking needed.

**Decision:** B (Same category + fallback)

---

## TD-03: Unlisted Video Access Strategy

**Scope:** Cross-layer

**Capability:** Vídeos unlisted acessíveis apenas via link direto (sem aparecer em listagens)

**Context:** Unlisted videos should be accessible to anyone with the direct link, but never appear in search results, channel pages, or suggested videos. The Video entity already has `visibility: 'unlisted'`. The choice is how to enforce this on the backend and frontend.

**Options:**

### Option A: Backend filter — exclude unlisted from all list queries
- All list endpoints (`findByChannel`, `findByChannelPublic`, `suggested`, search) add `WHERE visibility = 'public'`. The single-video endpoint `GET /api/videos/:id` returns the video regardless of visibility (anyone with the link can view).
- **Pros:** Simple — no token system needed. The ULID is unguessable (26 chars, 128 bits of entropy). Security-through-obscurity is acceptable for an MVP.
- **Cons:** Anyone who guesses or brute-forces a ULID can access unlisted videos. Mitigation: ULID entropy makes brute-force impractical (~2^128 combinations).

### Option B: Share token (signed URL parameter)
- When a video is set to `unlisted`, a `share_token` is generated (random 32-char hex) and stored in the Video entity. The watch URL becomes `/watch/:id?t=:token`. The backend validates the token on `GET /api/videos/:id` for unlisted videos. List endpoints still exclude unlisted.
- **Pros:** Explicit access control — only those with the full URL (including token) can view. Token can be rotated. More secure than bare ULID.
- **Cons:** More complex — token generation, storage, validation. URL sharing is less clean. Token management overhead.

### Option C: No special handling — unlisted is just a flag
- Unlisted videos are accessible via direct link (same as public). The only difference is they are excluded from all list/search queries. No token, no extra security.
- **Pros:** Simplest — just a WHERE clause in list queries. Zero additional code.
- **Cons:** Same as Option A but without ULID entropy argument.

**Recommendation:** **Option A (Backend filter + ULID entropy)** — The ULID is already unguessable, and the backend already has `visibility` filtering from Phase 04 (channel page only shows `public`). Adding `WHERE visibility = 'public'` to all list queries (suggestions, search, channel page) is sufficient. A share token system can be added later if needed. This is the YouTube unlisted model — anyone with the link can view.

**Decision:** A (Backend filter + ULID entropy)

---

## TD-04: Watch Page Layout Architecture

**Scope:** Frontend

**Capability:** Transversal — covers: "Layout da página: vídeo principal + informações + sidebar com sugestões", "Descrição do vídeo com expansão/recolhimento"

**Context:** The watch page at `/watch/[id]` is the most important page of the platform. It must load fast (first view matters), serve both anonymous and authenticated users, and handle the player, video info, description, and suggestions in a responsive layout.

**Options:**

### Option A: RSC page with client-side player
- `app/watch/[id]/page.tsx` — async RSC fetches video metadata + suggestions. Renders layout server-side. The HlsPlayer component is a Client Component (needs browser APIs). Description expand/collapse is a lightweight Client Component.
- **Pros:** Fast initial paint — HTML includes video metadata, description, and suggestions. SEO-friendly (RSC renders full content). Player hydrates client-side. No client-side data fetching waterfall.
- **Cons:** RSC cannot render the HLS player (needs `useEffect`, `useRef`). Two client boundaries (player + description toggle).

### Option B: Full client-side page
- `app/watch/[id]/page.tsx` — thin RSC shell. `<WatchPageClient>` client component fetches video + suggestions on mount, renders everything client-side.
- **Pros:** Single client boundary. Easy to manage state (player state, description open/closed).
- **Cons:** Slower initial load (shell + data fetch). No SEO for video metadata. Client-side waterfall.

### Option C: Hybrid — RSC for content, client for interactivity
- Same as Option A. Video metadata, description, and suggestions are server-rendered. Player and description toggle are client components embedded in the RSC tree.
- **Pros:** Best of both — content is server-rendered (SEO, fast paint), interactivity is client-side.
- **Cons:** Two client boundaries, but they are small and well-defined.

**Recommendation:** **Option A/C (RSC + client components)** — The HlsPlayer component already exists as a Client Component from Phase 03. The description expand/collapse is a small Client Component. Everything else (video title, metadata, suggestions sidebar) is server-rendered. This is the same pattern used in Phase 02 (auth pages) and is well-established in the project.

**Decision:** A (RSC + client components)

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Backend | View Counting Strategy | **B** (IP + 24h window) | **B** |
| TD-02 | Backend | Suggested Videos Query Strategy | **B** (Same category + fallback) | **B** |
| TD-03 | Cross-layer | Unlisted Video Access Strategy | **A** (Backend filter + ULID entropy) | **A** |
| TD-04 | Frontend | Watch Page Layout Architecture | **A** (RSC + client components) | **A** |

## New Dependencies

None — all required packages already installed (hls.js, tus-js-client, react-hook-form).

## New Docker Services

None.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/videos/dto/create-view.dto.ts` | Create | View tracking DTO |
| `src/videos/view.entity.ts` | Create | Video view entity (IP dedup) |
| `src/videos/videos.controller.ts` | Modify | Add view count, suggested, unlisted validation |
| `src/videos/videos.service.ts` | Modify | Add recordView, findSuggested |
| `src/database/migrations/` | Create | CreateVideoViews table |
| `next-frontend/app/watch/[id]/page.tsx` | Create | Watch page (RSC) |
| `next-frontend/components/video/description-expand.tsx` | Create | Expandable description |
| `next-frontend/components/video/suggested-videos.tsx` | Create | Suggested videos sidebar |
| `next-frontend/components/video/video-info.tsx` | Create | Video metadata display |
| `next-frontend/app/api/videos/[id]/view/route.ts` | Create | BFF view tracking |
| `next-frontend/mocks/handlers/videos.ts` | Modify | Add view, suggested handlers |