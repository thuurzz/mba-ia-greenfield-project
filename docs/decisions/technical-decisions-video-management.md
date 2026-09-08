---
scope_type: phase
related_phases: [4]
status: decided
date: 2026-09-01
scope_description: "Video categories, video editing, draft/publish flow, channel management panel, channel public page, and channel info editing for Phase 04 — Gerenciamento de Vídeos e Canal"
---

# Technical Decisions — Phase 04: Gerenciamento de Vídeos e Canal

_Subprojects in scope:_

- `nestjs-project/` — categories entity + CRUD, video PATCH endpoint, thumbnail upload, channel update endpoint, video listing endpoints (channel dashboard + public page)
- `next-frontend/` — channel management dashboard page, video edit page, channel public page, channel settings page, custom thumbnail uploader, category selector

---

## TD-01: Video Category Model

**Scope:** Backend

**Capability:** Categorias de vídeo disponíveis na plataforma

**Context:** Phase 04 introduces video categories. The Video entity already has a `categoryId: number | null` field. The question is whether categories are a fixed set of seed values (predefined list) or a fully dynamic user-defined tagging system. The choice affects the DB schema, API surface, and admin overhead.

**Options:**

### Option A: Fixed seeded categories (enum-like table)
- Create a `categories` table with `id`, `name`, `slug`, `display_order`. Seed with 10-15 predefined categories (Music, Gaming, Education, Entertainment, Sports, News, Technology, etc.) via a migration or seed script. The frontend fetches `GET /categories` to render a dropdown. Users cannot create new categories.
- **Pros:** Simple data model. No moderation overhead. Dropdown is predictable and easy to design. No category spam. Categories can be localized later.
- **Cons:** Users cannot create niche categories. Requires a seed migration. May need periodic updates to add new categories.

### Option B: User-defined tags (free-text)
- Replace the `categoryId` FK with a many-to-many `tags` table. Users type free-text tags. Autocomplete suggests existing tags. No predefined set.
- **Pros:** Maximum flexibility. Users describe content precisely. YouTube-like tagging UX.
- **Cons:** Tag spam and moderation overhead. Autocomplete requires a search endpoint. More complex schema (M:N join table). Harder to categorize and recommend. UX for tag input is more complex than a dropdown.

### Option C: Hybrid — fixed categories + free tags
- Both the `category_id` FK (required) and a many-to-many `tags` table (optional). Users pick one category from the fixed list and optionally add free-form tags.
- **Pros:** Best of both — structured navigation via categories, detailed description via tags. Industry standard (YouTube, Vimeo).
- **Cons:** Most complex schema (two associations). More UI surface. Overkill for an MVP — the project has no search-by-tag requirement yet.

**Recommendation:** **Option A (Fixed seeded categories)** — Simplest path for an MVP. The Video entity already has `categoryId`. A seed migration is trivial. If the project later needs free tags, the migration from Option A to Option C is additive (add a `tags` table, make `category_id` nullable) and does not break existing data.

**Decision:** A (Fixed seeded categories)

---

## TD-02: Video Update API Design

**Scope:** Backend

**Capability:** Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada

**Context:** The backend must expose an endpoint to update video metadata (title, description, category, visibility, custom thumbnail). The Video entity already exists with all fields. The choice is the HTTP method and update semantics.

**Options:**

### Option A: PATCH — partial update, single endpoint
- `PATCH /api/videos/:id` accepts a JSON body with only the fields to update. Uses TypeORM's `repository.update()` or `repository.save()` with partial entity. Validates ownership via channel lookup. Returns the updated video.
- **Pros:** RESTful standard for partial updates. Clients send only changed fields. Single endpoint for all edits. Works with react-hook-form's `dirtyFields` — only send changed values.
- **Cons:** Must handle the `null` vs "not provided" distinction (e.g., clearing description vs not changing it). Requires a DTO with optional fields.

### Option B: PUT — full replacement, single endpoint
- `PUT /api/videos/:id` requires all editable fields in the body. Missing fields are set to null/default.
- **Pros:** Simpler semantics — no ambiguity between "not provided" and "set to null". No need to check `undefined` vs `null`.
- **Cons:** Clients must send all fields even when editing one. More bandwidth. Worse UX for forms that only change one field. Forces the frontend to fetch current state before editing.

### Option C: Per-field endpoints (separate PATCH per concern)
- `PATCH /api/videos/:id/metadata` for title/description, `PATCH /api/videos/:id/visibility` for public/unlisted, `POST /api/videos/:id/thumbnail` for custom thumbnail.
- **Pros:** Each endpoint has a clear, narrow responsibility. Validates only relevant fields. Thumbnail can use multipart (file upload) while metadata uses JSON.
- **Cons:** N+1 endpoints. More code. More API surface to document. Frontend must coordinate multiple calls.

**Recommendation:** **Option A (PATCH — partial update)** — RESTful, minimal bandwidth, aligns with react-hook-form patterns. The `null` ambiguity is solved by using a DTO with all optional fields and a `@IsOptional()` decorator; a `PATCH` with `{ description: null }` clears the field, while omitting `description` leaves it unchanged.

**Decision:** A (PATCH partial update)

---

## TD-03: Custom Thumbnail Upload Strategy

**Scope:** Cross-layer

**Capability:** Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada

**Context:** Phase 03 auto-generates a thumbnail from a video frame. Phase 04 allows users to upload a custom thumbnail. The custom thumbnail must replace the auto-generated one in the Video entity's `thumbnailUrl` field. The upload can be handled via a dedicated endpoint or as part of the PATCH body.

**Options:**

### Option A: Dedicated multipart upload endpoint
- `POST /api/videos/:id/thumbnail` — accepts `multipart/form-data` with the image file. The backend validates the file (max 2MB, JPEG/PNG/WebP, max 2048px), uploads to MinIO at `thumbnails/{videoId}-custom.{ext}`, updates `thumbnailUrl`. The auto-generated thumbnail stays at `thumbnails/{videoId}.webp` (overwritten if same extension).
- **Pros:** Clean separation of concerns. File upload uses standard multipart, not base64 in JSON. Server-side validation of image dimensions and type. Works with tus-js-client-like file upload components.
- **Cons:** Requires a separate endpoint. Image processing (resize, crop) needs additional logic if desired.

### Option B: Base64 in PATCH body
- Include `thumbnailBase64: string | null` in the PATCH `/api/videos/:id` body. The backend decodes the base64, writes to MinIO, updates `thumbnailUrl`.
- **Pros:** Single endpoint for all edits. No multipart handling.
- **Cons:** Base64 is ~33% larger than binary. 2MB image becomes ~2.7MB in the JSON body. JSON parsing of large payloads is slower. No streaming. No progress tracking. Unusual pattern for image uploads.

### Option C: Presigned URL upload (frontend uploads directly to MinIO)
- `POST /api/videos/:id/thumbnail-upload` returns a presigned URL. The frontend uploads the file directly to MinIO, then calls `PATCH /api/videos/:id` with `{ thumbnailUrl: "thumbnails/{id}-custom.jpg" }`.
- **Pros:** Zero server-side bandwidth for the file. MinIO handles the upload directly.
- **Cons:** Requires two round-trips (get URL → upload → update metadata). CORS config on MinIO. Frontend must handle MinIO upload logic. Overkill for a 2MB file.

**Recommendation:** **Option A (Dedicated multipart upload endpoint)** — Simple, standard, server-side validation. The 2MB file size does not justify presigned URL complexity. The separate endpoint is cleaner than embedding base64 in JSON.

**Decision:** A (Dedicated multipart upload endpoint)

---

## TD-04: Channel Management Panel Architecture

**Scope:** Frontend

**Capability:** Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)

**Context:** The channel management panel is a dashboard where the channel owner views and manages their videos. It lists all videos with thumbnail, title, views, likes, comments, publish time, and status. It must be authenticated (only the channel owner). The architectural choice is between a single-page application (SPA-like) within the dashboard or a series of RSC pages.

**Options:**

### Option A: RSC-based dashboard page with search params
- `app/dashboard/page.tsx` — async RSC reads `searchParams.page` and `searchParams.status`, fetches paginated video list from the backend, renders a table/grid. Each row links to `app/dashboard/videos/[id]/edit` for editing. Filtering and pagination trigger server-side re-renders via `<Link>` or `<form>` with search params.
- **Pros:** Server-rendered, fast initial load. No client-side state management. Works with JS disabled (progressive enhancement). Simple architecture — no client-side data fetching library needed. Search params are bookmarkable.
- **Cons:** Every filter/page change causes a full server round-trip. No instant client-side transitions. Less "app-like" feel.

### Option B: Client-side dashboard with data fetching
- `app/dashboard/page.tsx` — thin RSC shell that renders a `<DashboardClient>` component. The client component fetches `GET /api/videos?channel={channelId}` on mount, manages pagination/filtering in state, renders the table. Uses `useEffect` or TanStack Query for data fetching.
- **Pros:** Instant client-side transitions between pages. Rich interactivity (bulk select, drag-and-drop reorder). More "app-like" feel.
- **Cons:** Client-side data fetching adds complexity. Loading states needed. Requires a client data-fetching strategy (native `fetch` vs TanStack Query). Initial load slower (shell + data fetch). No JS = no dashboard.

### Option C: Hybrid — RSC list + client-side modal/edit
- Dashboard list is RSC-rendered. Clicking a video row opens a client-side modal or slide-over panel (Client Component) that fetches the video detail via `fetch("/api/videos/[id]")` and renders the edit form. List re-renders server-side after edit.
- **Pros:** Best of both — list is fast and server-rendered, edit is interactive without page navigation. Modals preserve dashboard context.
- **Cons:** More complex architecture (RSC + Client boundary). Edit form state management inside a modal. Requires careful `router.refresh()` after edit to update the list.

**Recommendation:** **Option A (RSC-based dashboard with search params)** — For an MVP, RSC with search params is the simplest, fastest, and most maintainable approach. The dashboard is a straightforward table with filters; it does not need SPA-like transitions. Filtering via search params is bookmarkable and testable. If the team later wants richer interactivity, the migration to Option C (hybrid) is straightforward — add a client modal component without changing the list RSC.

**Decision:** A (RSC-based dashboard with search params)
**Renders in:** frontend-runtime

---

## TD-05: Channel Public Page — Rendering and Pagination

**Scope:** Frontend

**Capability:** Página pública do canal com informações e listagem de vídeos

**Context:** Each channel has a public page at `{host}/c/{nickname}` showing channel info (name, description, subscriber count) and a grid of published videos. This page is public (anonymous access). The key decisions are the caching strategy and pagination approach.

**Options:**

### Option A: RSC with infinite scroll (cursor-based pagination)
- `app/c/[nickname]/page.tsx` — async RSC fetches channel info + first page of videos via `GET /api/channels/:nickname/videos?cursor=...`. A `<LoadMore>` client component at the bottom triggers `fetch` for the next cursor page on scroll. Uses cursor-based pagination (ULID is sortable, TD-06 from Phase 03).
- **Pros:** Smooth UX — user scrolls, more videos load. Cursor is efficient for large datasets (no offset drift). ULID sortability makes cursor implementation trivial (`WHERE id < :cursor ORDER BY id DESC`). SEO-friendly for the first page (RSC-rendered).
- **Cons:** Requires a client component for the scroll trigger. Slightly more backend complexity (cursor parsing). No JS = no load-more (but first page still renders).

### Option B: RSC with numbered pages (offset-based pagination)
- `app/c/[nickname]/page.tsx` — async RSC fetches `GET /api/channels/:nickname/videos?page=1&limit=12`. Renders page numbers at the bottom. Each page link is a `<Link>` to `?page=N`, triggering a full server re-render.
- **Pros:** Simplest implementation. No client JS needed. Numbered pages are familiar to users. Links are bookmarkable.
- **Cons:** Offset pagination is inefficient for large datasets (OFFSET skips rows). Page numbers are less engaging than infinite scroll for a video grid. Full page navigation on every click.

### Option C: Static generation with ISR (for public pages)
- `app/c/[nickname]/page.tsx` — `generateStaticParams` pre-builds pages for popular channels. ISR revalidates every N minutes. Less popular channels are SSR or fallback.
- **Pros:** Fastest possible load (static HTML). Zero server load for popular channels.
- **Cons:** Complex build pipeline. Stale data until revalidation. Not suitable for channels with frequently changing video lists. Overkill for an MVP.

**Recommendation:** **Option A (RSC with cursor-based infinite scroll)** — Aligns with the ULID decision from Phase 03 (TD-06). Cursor pagination is efficient and the sortable ULID makes it trivial. The `LoadMore` client component is small and reusable across other video grids (home page, search results).

**Decision:** A (RSC with cursor-based infinite scroll)
**Renders in:** frontend-runtime

---

## TD-06: Draft→Publish Validation Rules

**Scope:** Backend

**Capability:** Fluxo de rascunho → publicação

**Context:** The Video entity has a `status` field. Currently, videos transition from `draft` → `uploading` → `processing` → `ready`/`failed`. Phase 04 adds the explicit "publish" action: a user edits a `ready` video's metadata and marks it as published. The question is what validation is required before publishing, and whether "published" is a new status or reflected by `visibility`.

**Options:**

### Option A: Publish = visibility toggle (no new status)
- Draft videos are created with `status: 'draft'`. After processing completes, status becomes `'ready'`. Publishing is changing `visibility` from `'unlisted'` to `'public'` (or keeping it `'public'`). No new status value. The "unpublished" state is implicit: `status: 'ready'` + `visibility: 'unlisted'`. The "published" state is `status: 'ready'` + `visibility: 'public'`.
- **Pros:** Simple — no new enum values. Visibility already exists. Users can have "unlisted" videos that are not shown on the channel page. No separate publish endpoint needed — just PATCH visibility.
- **Cons:** No explicit "published date" (`published_at`). All `ready` videos with `public` visibility are "published" automatically. No draft-once-published concept.

### Option B: New `published` status in the status enum
- Add `VideoStatus.PUBLISHED = 'published'`. The flow: `draft` → `uploading` → `processing` → `ready` → `published`. A user clicks "Publish" and the status changes from `ready` to `published`. A `published_at` timestamp is set. Only `published` videos appear in the channel page grid.
- **Pros:** Explicit publish action. `published_at` for sorting. Clear separation between "ready (processed but not published)" and "published". Users can prepare videos and publish later.
- **Cons:** New enum value means migration. One more status to manage. Backend must filter by `published` in the channel page query. The visibility field (public/unlisted) is still needed for access control — two orthogonal dimensions.

### Option C: Add `published_at` timestamp, keep existing statuses
- Keep the existing status flow. Add a nullable `published_at` timestamp column. When a user clicks "Publish" (via PATCH), the backend sets `published_at = NOW()` and `visibility = 'public'`. The channel page query filters `WHERE published_at IS NOT NULL AND visibility = 'public'`. A video can be "unpublished" by setting `published_at = NULL`.
- **Pros:** Explicit publish date for sorting. No new enum values. Backward-compatible with existing data. Clear separation of concerns: `status` = processing state, `published_at` = publication state, `visibility` = access control.
- **Cons:** Requires a new migration for `published_at` column. Three orthogonal dimensions instead of two.

**Recommendation:** **Option C (`published_at` timestamp)** — Cleanest separation of concerns. The existing `status` enum covers processing lifecycle. `published_at` covers intentional publication. `visibility` covers access control. The `published_at` approach is backward-compatible (existing `ready` videos simply have `published_at = NULL`). Sorting by `published_at DESC` for the channel page is efficient with an index.

**Decision:** C (`published_at` timestamp)

---

## TD-07: Channel Info Editing — Nickname Uniqueness

**Scope:** Backend

**Capability:** Edição das informações do canal: nickname, nome e descrição

**Context:** The Channel entity has `name`, `nickname` (unique), and `description`. The nickname is the channel's public URL handle (e.g., `/{nickname}`). Users can change their channel name and description freely, but nickname changes require uniqueness validation. The nickname was initially derived from the email prefix (Phase 02, TD-10). The question is how to handle nickname changes.

**Options:**

### Option A: Allow nickname change with uniqueness check
- Add a `PATCH /api/channels/me` endpoint. The `nickname` field is optional. If provided, the backend checks uniqueness (case-insensitive) and validates the same `[a-z0-9_]` allowlist from Phase 02 TD-10. On conflict, return `409` with `NICKNAME_ALREADY_TAKEN`. The channel page URL changes immediately.
- **Pros:** Users can choose their own URL handle. Reuses existing nickname sanitization logic. Consistent with Twitter/YouTube patterns.
- **Cons:** Nickname changes break existing bookmarks and shared links (mitigated by 301 redirect from old nickname). Uniqueness check adds a query. Users may impersonate others (mitigated by `[a-z0-9_]` allowlist — no special chars).

### Option B: Nickname is immutable (set once at registration)
- The nickname is derived from the email prefix at registration and cannot be changed. Users can only edit `name` and `description`.
- **Pros:** Simplest implementation. No uniqueness check needed. No broken links. No impersonation risk via nickname squatting.
- **Cons:** Users stuck with auto-generated nickname. If the email prefix is ugly (e.g., `john.doe.1987`), the channel handle is ugly. Less flexible.

### Option C: One-time nickname change + cooldown
- Users can change their nickname once, then must wait 30 days before changing again. A `nickname_changed_at` timestamp tracks the last change. The endpoint rejects changes within the cooldown period.
- **Pros:** Prevents squatting and rapid impersonation. Users get one chance to fix an ugly auto-generated nickname. Aligns with YouTube's limited-change policy.
- **Cons:** More complex — needs the timestamp, cooldown validation, and error messaging. Still breaks links (though only once).

**Recommendation:** **Option A (Allow change with uniqueness check)** — The MVP should allow users to customize their channel handle. The auto-generated nickname from the email prefix may be undesirable. Uniqueness validation reuses the existing `[a-z0-9_]` allowlist from Phase 02. Link breakage is acceptable for an MVP; a redirect mechanism can be added later.

**Decision:** A (Allow change with uniqueness check)

---

## TD-08: Channel Management Page — Video List Data Enrichment

**Scope:** Backend

**Capability:** Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)

**Context:** The dashboard endpoint must return video data enriched with computed fields: view count, like count, comment count, and publish time. The Video entity already has `viewCount` (incremented in Phase 05+). Likes and comments are Phase 06 entities. The question is what to return now vs what to defer.

**Options:**

### Option A: Return what exists now, add placeholders for future
- `GET /api/videos?channelId=X` returns all Video fields plus `likeCount: 0`, `commentCount: 0` (hardcoded until Phase 06). The frontend renders the grid with available data and shows "0" for likes/comments.
- **Pros:** Works today. No cross-phase dependency. Frontend can build the full UI now. When Phase 06 adds real counts, the backend replaces the hardcoded zeros with real queries — frontend changes nothing.
- **Cons:** Shows "0" for likes/comments until Phase 06. May confuse users (mitigated by hiding the count column via feature flag or showing "—").

### Option B: Return only existing fields, defer likes/comments
- `GET /api/videos?channelId=X` returns only fields that exist in the Video entity. The dashboard table has columns for thumbnail, title, views, status, publish time, and an "Edit" button. Like/comment columns are not rendered.
- **Pros:** Honest — no fake data. Less frontend code to handle placeholders.
- **Cons:** Dashboard will need UI changes when Phase 06 adds likes/comments. Two frontend changes instead of one.

**Recommendation:** **Option A (Return what exists, placeholder zeros)** — The frontend builds the full dashboard grid once. When Phase 06 adds real counts, only the backend query changes. The frontend can conditionally render the count columns only when `totalCount > 0` or simply display "—" for zero.

**Decision:** A (Return what exists, placeholder zeros)

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Backend | Video Category Model | **A** (Fixed seeded categories) | **A** |
| TD-02 | Backend | Video Update API Design | **A** (PATCH partial update) | **A** |
| TD-03 | Cross-layer | Custom Thumbnail Upload Strategy | **A** (Dedicated multipart upload endpoint) | **A** |
| TD-04 | Frontend | Channel Management Panel Architecture | **A** (RSC-based dashboard with search params) | **A** |
| TD-05 | Frontend | Channel Public Page — Rendering and Pagination | **A** (RSC with cursor-based infinite scroll) | **A** |
| TD-06 | Backend | Draft→Publish Validation Rules | **C** (`published_at` timestamp) | **C** |
| TD-07 | Backend | Channel Info Editing — Nickname Uniqueness | **A** (Allow change with uniqueness check) | **A** |
| TD-08 | Backend | Video List Data Enrichment | **A** (Return what exists, placeholder zeros) | **A** |

## New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| — | — | No new npm dependencies. All functionality uses existing packages (TypeORM, MinIO SDK, iron-session, react-hook-form) |

## New Docker Services

None. Existing services (PostgreSQL, MinIO, Redis) are sufficient.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/videos/category.entity.ts` | Create | Category entity |
| `src/videos/categories.controller.ts` | Create | GET /categories endpoint |
| `src/videos/categories.service.ts` | Create | Category CRUD |
| `src/videos/dto/update-video.dto.ts` | Create | PATCH video DTO |
| `src/videos/dto/update-channel.dto.ts` | Create | PATCH channel DTO |
| `src/videos/videos.controller.ts` | Modify | Add PATCH, GET by channel, thumbnail upload |
| `src/videos/videos.service.ts` | Modify | Add update, listByChannel, publish methods |
| `src/videos/video.entity.ts` | Modify | Add `published_at` column |
| `src/videos/storage.service.ts` | Modify | Add public bucket upload for thumbnails |
| `src/channels/channels.controller.ts` | Create | GET /channels/:nickname, PATCH /channels/me |
| `src/channels/channels.service.ts` | Modify | Add findByNickname, update |
| `src/database/migrations/` | Create | AddCategoryEntity, AddPublishedAt |
| `src/database/seeds/seed.ts` | Modify | Add category seed data |
| `next-frontend/app/dashboard/page.tsx` | Create | Channel management dashboard (RSC) |
| `next-frontend/app/dashboard/videos/[id]/edit/page.tsx` | Create | Video edit page |
| `next-frontend/app/c/[nickname]/page.tsx` | Create | Channel public page (RSC) |
| `next-frontend/app/c/[nickname]/settings/page.tsx` | Create | Channel settings page |
| `next-frontend/components/video/video-edit-form.tsx` | Create | Video edit form (Client) |
| `next-frontend/components/video/thumbnail-uploader.tsx` | Create | Custom thumbnail upload component |
| `next-frontend/components/channel/channel-settings-form.tsx` | Create | Channel settings form |
| `next-frontend/components/channel/channel-video-grid.tsx` | Create | Video grid component |
| `next-frontend/mocks/handlers/categories.ts` | Create | MSW handlers for categories |
| `next-frontend/mocks/handlers/videos.ts` | Modify | Add PATCH, list, thumbnail handlers |
| `next-frontend/mocks/handlers/channels.ts` | Create | MSW handlers for channels |