---
scope_type: phase
related_phases: [6]
status: decided
date: 2026-09-02
scope_description: "Video likes/dislikes, comments with nested replies, comment likes/dislikes, channel subscriptions, followed channels area, subscriber count for Phase 06 — Interações Sociais"
---

# Technical Decisions — Phase 06: Interações Sociais (Likes, Comentários, Inscrições)

_Subprojects in scope:_

- `nestjs-project/` — likes, comments, subscriptions entities + endpoints; subscriber count; comment replies
- `next-frontend/` — comment UI, like/dislike buttons, subscribe button, followed channels area, subscriber count display

---

## TD-01: Video Like/Dislike Model

**Scope:** Backend

**Capability:** Like e dislike em vídeos (usuários autenticados)

**Context:** Users must be able to like or dislike a video. A user can only have one reaction per video — liking again removes the like, disliking after liking switches to dislike. The choice is the data model and toggle behavior.

**Options:**

### Option A: Single `video_likes` table with `is_like` boolean
- `video_likes(video_id, user_id, is_like, created_at)`. Unique constraint on `(video_id, user_id)`. Toggle: if same `is_like` exists → DELETE (remove reaction). If different `is_like` → UPDATE (switch). If none → INSERT.
- **Pros:** Single table. Simple toggle logic. Easy to count likes vs dislikes (`WHERE is_like = true`). Unique constraint prevents duplicates.
- **Cons:** Table stores both likes and dislikes — slightly larger but negligible.

### Option B: Two separate tables — `video_likes` and `video_dislikes`
- Separate tables for each reaction type. Toggle = DELETE from one, INSERT into the other.
- **Pros:** Clear separation. Count queries are simple (`SELECT COUNT(*) FROM video_likes`).
- **Cons:** Two tables to manage. Toggle logic needs two operations. More complex queries for "user's current reaction".

### Option C: Counter columns on Video entity
- Add `likes_count` and `dislikes_count` columns to the Video entity. Increment/decrement on each action. No separate table.
- **Pros:** Fast reads — count is on the video row. No JOIN needed. Simple.
- **Cons:** No audit trail — cannot list who liked. Cannot prevent double-count. Race conditions on increment/decrement. No way to show "you liked this" to the user.

**Recommendation:** **Option A (Single `video_likes` table)** — Best balance. Single table, simple toggle, unique constraint prevents duplicates. Count queries are fast with an index on `(video_id, is_like)`. The `(video_id, user_id)` unique constraint also lets us show "you liked/disliked this" easily.

**Decision:** A (Single video_likes table)

---

## TD-02: Comments Model — Nesting Depth

**Scope:** Backend

**Capability:** Transversal — covers: "Comentários em vídeos (usuários autenticados)", "Respostas a comentários (comentários aninhados)"

**Context:** Comments must support nested replies. The choice is the maximum nesting depth and how to model the parent-child relationship.

**Options:**

### Option A: Single-level nesting (parent_id FK, max 2 levels)
- `comments(id, video_id, user_id, body, parent_id NULLABLE, created_at)`. `parent_id` references `comments.id`. Only one level of nesting allowed — replies cannot have replies. Frontend shows flat list or 2-level indentation.
- **Pros:** Simple model. Single query to get all comments + parent_id for grouping. No recursion needed. Easy to paginate. No "deep thread" UX issues.
- **Cons:** Users cannot reply to replies. Less flexible than unlimited nesting.

### Option B: Unlimited nesting (parent_id FK, recursive)
- Same model as Option A but allows any depth. Frontend renders threaded view with indentation for each level. Backend uses recursive CTE to fetch full thread.
- **Pros:** Maximum flexibility. Users can reply at any depth. YouTube-like threading.
- **Cons:** Recursive queries are more complex. Pagination is harder. Deep threads become visually messy. Frontend needs recursive rendering.

### Option C: Flat comments with no nesting
- No `parent_id`. All comments are top-level. Replies are not supported.
- **Pros:** Simplest model. Fastest queries. Easiest pagination.
- **Cons:** No threaded discussions. Less engaging. The requirement explicitly says "comentários aninhados".

**Recommendation:** **Option A (Single-level nesting, max 2 levels)** — Best UX for an MVP. Users can reply to comments, but replies cannot have replies. This avoids the "infinite thread" problem while supporting the core use case. The model is simple and queries are fast. YouTube itself limits nesting in practice.

**Decision:** A (Single-level nesting, max 2 levels)

---

## TD-03: Comment Like/Dislike Model

**Scope:** Backend

**Capability:** Like e dislike em comentários (usuários autenticados)

**Context:** Comments should have the same like/dislike functionality as videos. The same toggle pattern applies.

**Options:**

### Option A: Reuse same pattern — `comment_likes` table
- `comment_likes(comment_id, user_id, is_like, created_at)`. Unique constraint on `(comment_id, user_id)`. Same toggle logic as TD-01.
- **Pros:** Consistent with video likes. Same service pattern. Simple to implement.
- **Cons:** One more table — but that's expected.

### Option B: Generalized `reactions` table (polymorphic)
- `reactions(target_type, target_id, user_id, type, created_at)`. `target_type` is 'video' or 'comment'. Single table for all reactions.
- **Pros:** Single table for all likes. Easy to add new reaction types later.
- **Cons:** Polymorphic FK cannot use foreign key constraints. Query performance is worse (no typed FK index). More complex queries. No DB-level referential integrity.

**Recommendation:** **Option A (Separate `comment_likes` table)** — Consistent with video likes. Simple, type-safe, with proper FK constraints. The polymorphic approach (Option B) sacrifices referential integrity for no real benefit — the project has only two reaction targets.

**Decision:** A (Separate comment_likes table)

---

## TD-04: Subscription Model

**Scope:** Backend

**Capability:** Transversal — covers: "Inscrição em canais (seguir/deixar de seguir)", "Contagem de inscritos na página do canal"

**Context:** Users can subscribe to channels. The subscription is a many-to-many relationship between users (subscribers) and channels. The choice is the data model and whether to maintain a denormalized counter.

**Options:**

### Option A: `subscriptions` table + denormalized counter on Channel
- `subscriptions(channel_id, subscriber_id, created_at)`. Unique constraint on `(channel_id, subscriber_id)`. Add `subscriber_count` column to the `channels` table, updated on subscribe/unsubscribe.
- **Pros:** Fast subscriber count reads (no COUNT query). Unique constraint prevents duplicates. Simple model.
- **Cons:** Counter must be updated atomically with the subscription insert/delete. Slight risk of drift.

### Option B: `subscriptions` table only (no counter)
- Same table, no counter column. Count is computed via `SELECT COUNT(*) FROM subscriptions WHERE channel_id = X`.
- **Pros:** No drift risk. Single source of truth. Simpler code.
- **Cons:** COUNT query on every channel page load. For an MVP with small user base, this is negligible.

### Option C: `subscriptions` table + Redis cache for count
- Table for persistence, Redis for cached count. On subscribe/unsubscribe, update Redis. Channel page reads from Redis.
- **Pros:** Fastest reads. No DB COUNT query. Redis is already in the stack (Phase 03).
- **Cons:** Redis adds complexity. Cache invalidation. Overkill for an MVP.

**Recommendation:** **Option A (`subscriptions` table + denormalized counter)** — The counter column is simple and the update is atomic (`increment`/`decrement`). The risk of drift is minimal and can be fixed with a periodic sync job. Redis is unnecessary for this scale.

**Decision:** A (Subscriptions table + denormalized counter)

---

## TD-05: Followed Channels Area — Data Source

**Scope:** Frontend

**Capability:** Área de canais seguidos com acesso rápido aos vídeos

**Context:** The followed channels area shows a list of channels the user has subscribed to, with quick access to their videos. The choice is where this data is fetched and rendered.

**Options:**

### Option A: RSC sidebar — fetched server-side with session
- `GET /api/subscriptions?userId=X` returns subscribed channels. Rendered in a sidebar RSC component on the home page (Phase 07) or as a standalone page. The BFF proxies to NestJS.
- **Pros:** Server-rendered, fast. Session determines the user. No client-side fetch.
- **Cons:** Only available on pages that include the sidebar RSC.

### Option B: Client-side dropdown/modal
- A "My Channels" button triggers a client component that fetches subscriptions and renders a list/modal.
- **Pros:** Accessible from any page. Can be a reusable component.
- **Cons:** Client-side fetch adds latency. Need loading/error states.

### Option C: Dedicated page `/subscriptions`
- Standalone page listing all followed channels. Each channel shows latest videos. Paginated.
- **Pros:** Full page for managing subscriptions. Can show latest videos from each channel.
- **Cons:** Requires navigation away from current page.

**Recommendation:** **Option A (RSC sidebar) + Option C (dedicated page)** — Combine both. A sidebar on the home page shows the list of followed channels (Phase 07). A dedicated `/subscriptions` page shows latest videos from all followed channels. The RSC sidebar is lightweight and server-rendered.

**Decision:** A + C (RSC sidebar + dedicated page)

---

## TD-06: Comment Pagination Strategy

**Scope:** Backend

**Capability:** Comentários em vídeos (usuários autenticados)

**Context:** A video may have hundreds of comments. The comments API must support pagination. The choice is between cursor-based and offset-based pagination.

**Options:**

### Option A: Cursor-based (using comment id / created_at)
- `GET /api/videos/:id/comments?cursor=:lastCommentId&limit=20` returns next page. Ordered by `created_at DESC` or `likes_count DESC`.
- **Pros:** Consistent with existing pagination pattern (Phase 03, 04). No offset drift. Efficient for large datasets.
- **Cons:** Slightly more complex client logic. Cannot jump to a specific page.

### Option B: Offset-based (page number)
- `GET /api/videos/:id/comments?page=1&limit=20`. Simple offset pagination.
- **Pros:** Simple. Can jump to page N. Familiar to users.
- **Cons:** Offset drift if comments are added between requests. Less efficient for large offsets.

**Recommendation:** **Option A (Cursor-based)** — Consistent with the ULID-based cursor pagination used in Phases 03 and 04. The `created_at` timestamp is a natural cursor for comments.

**Decision:** A (Cursor-based)

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|----------------|--------|
| TD-01 | Backend | Video Like/Dislike Model | **A** (Single video_likes table) | **A** |
| TD-02 | Backend | Comments Model — Nesting Depth | **A** (Single-level, max 2 levels) | **A** |
| TD-03 | Backend | Comment Like/Dislike Model | **A** (Separate comment_likes table) | **A** |
| TD-04 | Backend | Subscription Model | **A** (Subscriptions table + counter) | **A** |
| TD-05 | Frontend | Followed Channels — Data Source | **A + C** (RSC sidebar + dedicated page) | **A + C** |
| TD-06 | Backend | Comment Pagination Strategy | **A** (Cursor-based) | **A** |

## New Dependencies

None.

## New Docker Services

None.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/videos/video-like.entity.ts` | Create | Video likes entity |
| `src/videos/comments/comment.entity.ts` | Create | Comment entity |
| `src/videos/comments/comment-like.entity.ts` | Create | Comment likes entity |
| `src/videos/comments/comments.service.ts` | Create | Comment CRUD |
| `src/videos/comments/comments.controller.ts` | Create | Comment endpoints |
| `src/videos/comments/comments.module.ts` | Create | Comment module |
| `src/social/subscription.entity.ts` | Create | Subscription entity |
| `src/social/subscriptions.service.ts` | Create | Subscription CRUD |
| `src/social/subscriptions.controller.ts` | Create | Subscription endpoints |
| `src/social/social.module.ts` | Create | Social module |
| `src/channels/entities/channel.entity.ts` | Modify | Add subscriber_count column |
| `src/videos/videos.controller.ts` | Modify | Add like/dislike endpoints |
| `src/videos/videos.service.ts` | Modify | Add like/dislike methods |
| `src/videos/videos.module.ts` | Modify | Register VideoLike entity |
| `src/app.module.ts` | Modify | Register SocialModule, CommentsModule |
| `src/database/migrations/` | Create | Add likes, comments, subscriptions tables |
| `next-frontend/components/video/like-buttons.tsx` | Create | Like/dislike buttons |
| `next-frontend/components/video/comment-section.tsx` | Create | Comment section |
| `next-frontend/components/video/comment-form.tsx` | Create | Comment form |
| `next-frontend/components/video/subscribe-button.tsx` | Create | Subscribe button |
| `next-frontend/components/social/followed-channels.tsx` | Create | Followed channels sidebar |
| `next-frontend/app/subscriptions/page.tsx` | Create | Subscriptions page |
| `next-frontend/app/api/videos/[id]/likes/route.ts` | Create | BFF likes proxy |
| `next-frontend/app/api/videos/[id]/comments/route.ts` | Create | BFF comments proxy |
| `next-frontend/app/api/subscriptions/route.ts` | Create | BFF subscriptions proxy |
| `next-frontend/mocks/handlers/social.ts` | Create | MSW handlers for social |