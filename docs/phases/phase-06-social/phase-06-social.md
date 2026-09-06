---
kind: phase
name: phase-06-social
test_specs_aware: true
sources_mtime:
  docs/phases/phase-06-social/context.md: "2026-09-02 22:39:24.165554036 -0300"
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

# Phase 06 — Interações Sociais (Likes, Comentários, Inscrições)

## Objective

Deliver the complete social interactions layer — video likes/dislikes with toggle, comments with single-level nested replies, comment likes/dislikes, channel subscriptions with subscriber count, followed channels sidebar, and a dedicated subscriptions page.

---

## Step Implementations

### SI-06.1 — Video Like/Dislike Entity, Migration, and Endpoints

**Description:** Create the `video_likes` table, migration, and toggle endpoint for video likes/dislikes. Add `likes_count` and `dislikes_count` counter columns to the Video entity.

**Technical actions:**

- Create `src/videos/video-like.entity.ts`:
  - `id: number` — PK auto-increment
  - `videoId: string` — FK → videos, NOT NULL
  - `userId: string` — FK → users, NOT NULL
  - `isLike: boolean` — NOT NULL (true = like, false = dislike)
  - `createdAt: Date` — timestamp
  - Unique constraint on `(video_id, user_id)`
- Add to `Video` entity: `likesCount: number` (default 0), `dislikesCount: number` (default 0)
- Generate migration: `npm run typeorm -- migration:generate -d src/database/data-source.ts src/database/migrations/CreateVideoLikes`
- Add to `VideosService`:
  ```typescript
  async toggleLike(videoId: string, userId: string, isLike: boolean): Promise<{ liked: boolean; likesCount: number; dislikesCount: number }>
  ```
  - Find existing reaction by `(videoId, userId)`
  - If same `isLike` exists → DELETE (remove reaction)
  - If different `isLike` exists → UPDATE to new value
  - If none → INSERT
  - Update counter columns via `increment`/`decrement`
- Add to `VideosController`:
  - `POST /api/videos/:id/like` — authenticated, toggles like
  - `POST /api/videos/:id/dislike` — authenticated, toggles dislike
  - `GET /api/videos/:id/likes` — public, returns `{ likesCount, dislikesCount, userReaction }` (userReaction null if not authenticated)
- Register `VideoLike` in VideosModule
- Create BFF route handler `next-frontend/app/api/videos/[id]/likes/route.ts`

**TD reference:** social/TD-01 (Single video_likes table)

**Acceptance criteria:**
- `POST /api/videos/:id/like` creates a like, second call removes it
- `POST /api/videos/:id/dislike` after like switches to dislike
- Counts update correctly on toggle
- Unauthenticated request returns 401
- GET returns current counts and user's reaction (if authenticated)

---

### SI-06.2 — Comment Entity, Migration, and Endpoints

**Description:** Create the `comments` table with `parent_id` for single-level nesting, migration, and CRUD endpoints with cursor-based pagination.

**Technical actions:**

- Create `src/videos/comments/comment.entity.ts`:
  - `id: number` — PK auto-increment
  - `videoId: string` — FK → videos, NOT NULL
  - `userId: string` — FK → users, NOT NULL
  - `body: string` — text, NOT NULL
  - `parentId: number` — nullable, FK → comments.id (self-referencing)
  - `likesCount: number` — default 0
  - `dislikesCount: number` — default 0
  - `createdAt: Date` — timestamp
  - Index on `(video_id, created_at)` for cursor pagination
- Create `src/videos/comments/comments.service.ts`:
  - `create(videoId, userId, body, parentId?)` — validates parentId exists and is top-level (no nested replies to replies)
  - `findByVideo(videoId, cursor?, limit?)` — cursor-based pagination by `created_at`, includes replies grouped by parent_id
  - `delete(commentId, userId)` — owner only
- Create `src/videos/comments/comments.controller.ts`:
  - `GET /api/videos/:id/comments` — public, paginated
  - `POST /api/videos/:id/comments` — authenticated, create comment
  - `DELETE /api/videos/:id/comments/:commentId` — authenticated, owner only
- Create `src/videos/comments/comments.module.ts` with TypeOrmModule.forFeature([Comment])
- Register CommentsModule in AppModule
- Create BFF route handler `next-frontend/app/api/videos/[id]/comments/route.ts`

**TD references:** social/TD-02 (Single-level nesting, max 2 levels), social/TD-06 (Cursor-based pagination)

**Acceptance criteria:**
- `POST /api/videos/:id/comments` creates a top-level comment
- `POST` with `parentId` creates a reply to a comment
- Reply to a reply returns 400 (max 2 levels)
- `GET` returns comments with cursor pagination, replies nested under parents
- `DELETE` removes own comment
- Non-owner cannot delete

---

### SI-06.3 — Comment Like/Dislike Entity, Migration, and Endpoints

**Description:** Create the `comment_likes` table, migration, and toggle endpoint for comment likes/dislikes.

**Technical actions:**

- Create `src/videos/comments/comment-like.entity.ts`:
  - `id: number` — PK auto-increment
  - `commentId: number` — FK → comments, NOT NULL
  - `userId: string` — FK → users, NOT NULL
  - `isLike: boolean` — NOT NULL
  - `createdAt: Date` — timestamp
  - Unique constraint on `(comment_id, user_id)`
- Generate migration (combined with comments migration)
- Add to `CommentsService`:
  ```typescript
  async toggleCommentLike(commentId: number, userId: string, isLike: boolean)
  ```
  - Same toggle logic as video likes
  - Update `likesCount`/`dislikesCount` on Comment entity
- Add to `CommentsController`:
  - `POST /api/videos/:id/comments/:commentId/like` — authenticated
  - `POST /api/videos/:id/comments/:commentId/dislike` — authenticated
- Register `CommentLike` in CommentsModule

**TD reference:** social/TD-03 (Separate comment_likes table)

**Acceptance criteria:**
- Like/dislike toggle works on comments
- Counts update correctly
- Same toggle behavior as video likes

---

### SI-06.4 — Subscription Entity, Migration, and Endpoints + Subscriber Count

**Description:** Create the `subscriptions` table, migration, add `subscriber_count` to Channel entity, and endpoints for subscribe/unsubscribe + subscriber count.

**Technical actions:**

- Create `src/social/subscription.entity.ts`:
  - `id: number` — PK auto-increment
  - `channelId: string` — FK → channels, NOT NULL
  - `subscriberId: string` — FK → users, NOT NULL
  - `createdAt: Date` — timestamp
  - Unique constraint on `(channel_id, subscriber_id)`
- Add `subscriberCount: number` (default 0) to `Channel` entity
- Generate migration: `npm run typeorm -- migration:generate -d src/database/data-source.ts src/database/migrations/CreateSocialTables`
- Create `src/social/subscriptions.service.ts`:
  - `subscribe(channelId, subscriberId)` — insert, increment channel.subscriberCount
  - `unsubscribe(channelId, subscriberId)` — delete, decrement channel.subscriberCount
  - `isSubscribed(channelId, subscriberId)` — returns boolean
  - `findBySubscriber(subscriberId, cursor?, limit?)` — paginated subscriptions
  - `countByChannel(channelId)` — returns subscriber count (from Channel entity)
- Create `src/social/subscriptions.controller.ts`:
  - `POST /api/channels/:channelId/subscribe` — authenticated
  - `POST /api/channels/:channelId/unsubscribe` — authenticated
  - `GET /api/channels/:channelId/subscribed` — public, returns `{ isSubscribed }` (false if not authenticated)
  - `GET /api/subscriptions` — authenticated, returns paginated subscriptions
- Create `src/social/social.module.ts` — register Subscription entity, SubscriptionsService, SubscriptionsController
- Register SocialModule in AppModule
- Create BFF route handlers:
  - `next-frontend/app/api/channels/[channelId]/subscribe/route.ts`
  - `next-frontend/app/api/subscriptions/route.ts`

**TD reference:** social/TD-04 (Subscriptions table + denormalized counter)

**Acceptance criteria:**
- `POST /api/channels/:channelId/subscribe` creates subscription and increments counter
- `POST /api/channels/:channelId/unsubscribe` removes subscription and decrements counter
- Double subscribe returns 409 (unique constraint)
- `GET /api/channels/:channelId/subscribed` returns current user's status
- `GET /api/subscriptions` returns paginated list of subscribed channels

---

### SI-06.5 — Frontend: Like/Dislike, Subscribe Buttons, Comment Section

**Description:** Create the frontend components for social interactions: like/dislike buttons, subscribe button, comment section with form, and integrate them into the watch page.

**Technical actions:**

- Create `next-frontend/components/video/like-buttons.tsx`:
  - `"use client"` — fetches `GET /api/videos/:id/likes` on mount
  - Like and dislike buttons with counts
  - Click toggles via `POST /api/videos/:id/like` or `/dislike`
  - Optimistic UI update on click
  - Requires authentication (show login prompt if not authenticated)
- Create `next-frontend/components/video/subscribe-button.tsx`:
  - `"use client"` — fetches subscription status on mount
  - Toggle subscribe/unsubscribe
  - Shows subscriber count
- Create `next-frontend/components/video/comment-section.tsx`:
  - `"use client"` — fetches comments via cursor pagination
  - Renders comment list with replies indented
  - "Load More" button for pagination
- Create `next-frontend/components/video/comment-form.tsx`:
  - Text area + submit button
  - Calls `POST /api/videos/:id/comments`
  - Supports `parentId` for replies (reply button on each comment)
- Integrate all components into the watch page at `app/watch/[id]/page.tsx`
- Create MSW handlers in `next-frontend/mocks/handlers/social.ts`
- Update MSW barrel index

**TD references:** social/TD-01, social/TD-02, social/TD-03, social/TD-05, social/TD-06

**Acceptance criteria:**
- Like/dislike buttons render with counts and toggle correctly
- Subscribe button shows correct state and toggles
- Comment section displays comments with replies
- Reply button opens comment form with parentId
- "Load More" loads next page of comments
- Unauthenticated users see login prompt for interactive actions

---

### SI-06.6 — Subscriptions Page and Followed Channels Sidebar

**Description:** Create the subscriptions page (`/subscriptions`) and the followed channels sidebar component for the home page.

**Technical actions:**

- Create `next-frontend/app/subscriptions/page.tsx`:
  - RSC fetches `GET /api/subscriptions` with session
  - Lists subscribed channels with links to channel pages
  - Shows latest video from each channel (placeholder — Phase 07 adds video grid)
- Create `next-frontend/components/social/followed-channels.tsx`:
  - RSC or client component listing subscribed channels
  - Each entry: channel avatar, name, link to channel page
  - Compact sidebar layout
- Create BFF route handler `next-frontend/app/api/subscriptions/route.ts`:
  - `GET` — proxies to NestJS, returns paginated subscriptions
- Create MSW handlers for subscriptions

**TD reference:** social/TD-05 (RSC sidebar + dedicated page)

**Acceptance criteria:**
- `/subscriptions` page lists all subscribed channels
- Followed channels sidebar renders on home page
- Each channel links to `/c/[nickname]`
- Unauthenticated users see empty state

---

## Technical Specifications

### Data Model

**VideoLike Entity** (`video_likes`)

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | PK, auto-increment |
| `video_id` | varchar(26) | FK → videos, NOT NULL |
| `user_id` | uuid | FK → users, NOT NULL |
| `is_like` | boolean | NOT NULL |
| `created_at` | timestamp | default now() |

Unique: `(video_id, user_id)`. Index: `(video_id, is_like)`.

**Comment Entity** (`comments`)

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | PK, auto-increment |
| `video_id` | varchar(26) | FK → videos, NOT NULL |
| `user_id` | uuid | FK → users, NOT NULL |
| `body` | text | NOT NULL |
| `parent_id` | integer | nullable, FK → comments.id |
| `likes_count` | integer | default 0 |
| `dislikes_count` | integer | default 0 |
| `created_at` | timestamp | default now() |

Index: `(video_id, created_at)`.

**CommentLike Entity** (`comment_likes`)

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | PK, auto-increment |
| `comment_id` | integer | FK → comments, NOT NULL |
| `user_id` | uuid | FK → users, NOT NULL |
| `is_like` | boolean | NOT NULL |
| `created_at` | timestamp | default now() |

Unique: `(comment_id, user_id)`.

**Subscription Entity** (`subscriptions`)

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | PK, auto-increment |
| `channel_id` | uuid | FK → channels, NOT NULL |
| `subscriber_id` | uuid | FK → users, NOT NULL |
| `created_at` | timestamp | default now() |

Unique: `(channel_id, subscriber_id)`.

**Video Entity — new fields**

| Field | Type | Constraints |
|-------|------|-------------|
| `likes_count` | integer | default 0 |
| `dislikes_count` | integer | default 0 |

**Channel Entity — new field**

| Field | Type | Constraints |
|-------|------|-------------|
| `subscriber_count` | integer | default 0 |

### API Contracts

**Backend Tier (NestJS)**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/videos/:id/like` | JWT | Toggle like |
| `POST` | `/api/videos/:id/dislike` | JWT | Toggle dislike |
| `GET` | `/api/videos/:id/likes` | Public | Get counts + user reaction |
| `GET` | `/api/videos/:id/comments` | Public | List comments (cursor) |
| `POST` | `/api/videos/:id/comments` | JWT | Create comment |
| `DELETE` | `/api/videos/:id/comments/:commentId` | JWT | Delete own comment |
| `POST` | `/api/videos/:id/comments/:commentId/like` | JWT | Toggle comment like |
| `POST` | `/api/videos/:id/comments/:commentId/dislike` | JWT | Toggle comment dislike |
| `POST` | `/api/channels/:channelId/subscribe` | JWT | Subscribe |
| `POST` | `/api/channels/:channelId/unsubscribe` | JWT | Unsubscribe |
| `GET` | `/api/channels/:channelId/subscribed` | Public | Check if subscribed |
| `GET` | `/api/subscriptions` | JWT | List subscriptions |

### Authorization Matrix

| Resource | Action | Role | Condition |
|----------|--------|------|-----------|
| Video like | Toggle | Authenticated | Any user |
| Comment | Create | Authenticated | Any user |
| Comment | Delete | Authenticated | Owner only |
| Comment like | Toggle | Authenticated | Any user |
| Subscription | Toggle | Authenticated | Any user |
| Subscriptions list | Read | Authenticated | Own subscriptions only |

### Error Catalog

| Error code | HTTP status | Description |
|------------|-------------|-------------|
| `COMMENT_NOT_FOUND` | 404 | Comment ID does not exist |
| `COMMENT_NOT_OWNER` | 403 | Cannot delete another user's comment |
| `NESTING_LIMIT_REACHED` | 400 | Cannot reply to a reply |
| `ALREADY_SUBSCRIBED` | 409 | Already subscribed to this channel |
| `NOT_SUBSCRIBED` | 404 | Not subscribed to this channel |

## Dependency Map

| SI | Dependencies | Depends on |
|----|-------------|------------|
| SI-06.1 | Phase 02 + 05 | Video entity, auth |
| SI-06.2 | SI-06.1 (VideosService pattern) | SI-06.1 |
| SI-06.3 | SI-06.2 (Comment entity exists) | SI-06.2 |
| SI-06.4 | Phase 02 (auth), Channel entity | — |
| SI-06.5 | SI-06.1 (like endpoints), SI-06.2 (comment endpoints), SI-06.3 (comment like), SI-06.4 (subscribe), Phase 05 (watch page) | SI-06.1, SI-06.2, SI-06.3, SI-06.4 |
| SI-06.6 | SI-06.4 (subscription endpoints) | SI-06.4 |

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
1. Like a video — count increments, second click removes
2. Switch from like to dislike — counts update
3. Post a comment on a video
4. Reply to a comment
5. Try to reply to a reply — should fail
6. Like a comment
7. Subscribe to a channel — count increments
8. Unsubscribe — count decrements
9. View subscriptions page — lists subscribed channels
10. Watch page shows like/dislike buttons, comment section, subscribe button