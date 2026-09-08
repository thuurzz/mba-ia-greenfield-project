---
kind: phase
name: phase-04-video-management
test_specs_aware: true
sources_mtime:
  docs/phases/phase-04-video-management/context.md: "2026-09-01 20:04:55.062420711 -0300"
  docs/decisions/technical-decisions-video-management.md: "2026-09-01 20:20:22.832639110 -0300"
  docs/decisions/technical-decisions-openapi-docs-nestjs.md: "2026-08-31 22:18:23.870206069 -0300"
  docs/decisions/technical-decisions-next-frontend-config-base.md: "2026-08-31 22:18:23.870073071 -0300"
  docs/decisions/technical-decisions-next-frontend-openapi-typing.md: "2026-08-31 22:18:23.870206069 -0300"
  docs/decisions/technical-decisions-next-frontend-msw-foundation.md: "2026-08-31 22:18:23.870206069 -0300"
  docs/phases/phase-01-configuracao-base/context.md: "2026-08-31 22:18:23.871746970 -0300"
  docs/phases/phase-02-auth/context.md: "2026-08-31 22:18:23.872182547 -0300"
  docs/phases/phase-02-auth-frontend/context.md: "2026-08-31 22:18:23.871797307 -0300"
  docs/phases/phase-03-videos/context.md: "2026-08-31 23:21:35.508204031 -0300"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-08-31 22:18:23.772557281 -0300"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-08-31 22:18:23.773628364 -0300"
---

# Phase 04 — Gerenciamento de Vídeos e Canal

## Objective

Deliver the complete video and channel management experience — categories, video metadata editing, custom thumbnail upload, draft-to-publish workflow, channel management dashboard, channel settings editing, and public channel page with video listing.

---

## Step Implementations

### SI-04.1 — Category Entity, Migration, and Seed Data

**Description:** Create the Category entity, migration, and seed script with predefined categories (Music, Gaming, Education, Entertainment, Sports, News, Technology, etc.). Expose GET /api/categories endpoint.

**Technical actions:**

- Create `src/videos/category.entity.ts`:
  - `id: number` — `@PrimaryGeneratedColumn()`
  - `name: string` — `varchar(50)`, NOT NULL
  - `slug: string` — `varchar(50)`, NOT NULL, UNIQUE
  - `displayOrder: number` — `integer`, default 0, `@Column({ name: 'display_order' })`
- Generate migration: `npm run typeorm -- migration:generate -d src/database/data-source.ts src/database/migrations/CreateCategoryEntity`
- Create `src/videos/categories.service.ts` — `findAll()` returning all categories ordered by `display_order`
- Create `src/videos/categories.controller.ts`:
  - `GET /api/categories` — `@Public()`, returns list of categories
- Register `Category` in `TypeOrmModule.forFeature([Category])` in VideosModule
- Add `CategoriesController` and `CategoriesService` to VideosModule providers
- Update `src/database/seeds/seed.ts` — seed categories:
  ```typescript
  const categories = [
    { name: 'Music', slug: 'music', displayOrder: 1 },
    { name: 'Gaming', slug: 'gaming', displayOrder: 2 },
    { name: 'Education', slug: 'education', displayOrder: 3 },
    { name: 'Entertainment', slug: 'entertainment', displayOrder: 4 },
    { name: 'Sports', slug: 'sports', displayOrder: 5 },
    { name: 'News', slug: 'news', displayOrder: 6 },
    { name: 'Technology', slug: 'technology', displayOrder: 7 },
    { name: 'Science', slug: 'science', displayOrder: 8 },
    { name: 'Comedy', slug: 'comedy', displayOrder: 9 },
    { name: 'How-to & DIY', slug: 'how-to-diy', displayOrder: 10 },
    { name: 'Vlogs', slug: 'vlogs', displayOrder: 11 },
    { name: 'Other', slug: 'other', displayOrder: 99 },
  ];
  ```

**TD references:** video-management/TD-01 (Fixed seeded categories)

**Acceptance criteria:**

- `GET /api/categories` returns all seeded categories ordered by display_order
- Category with invalid slug returns 404 (not applicable — fixed list)
- Seed script inserts categories without duplicates
- Migration creates categories table with correct constraints

---

### SI-04.2 — Video PATCH Endpoint and UpdateVideoDTO

**Description:** Create the PATCH /api/videos/:id endpoint for partial video metadata updates (title, description, category_id, visibility). Add ownership validation.

**Technical actions:**

- Create `src/videos/dto/update-video.dto.ts`:
  ```typescript
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  category_id?: number;

  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility;
  ```
- Add `updateVideo(id, channelId, dto)` to `VideosService`:
  - Verify ownership: `video.channelId === channelId`, else throw `VIDEO_NOT_OWNER`
  - Update only provided fields using `repository.update()`
  - Return updated video
- Add to `VideosController`:
  ```typescript
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateVideoDto, @CurrentUser() user: JwtPayload) {
    const channel = await this.channelsService.findByUserId(user.sub);
    return this.videosService.updateVideo(id, channel.id, dto);
  }
  ```
- Create BFF route handler `next-frontend/app/api/videos/[id]/route.ts`:
  - `PATCH` — reads session, proxies to NestJS, returns response
- Create MSW handler for PATCH /api/videos/:id
- Create integration test: `app/api/videos/[id]/__tests__/route.integration.test.ts`

**TD references:** video-management/TD-02 (PATCH partial update)

**Acceptance criteria:**

- `PATCH /api/videos/:id` with valid body updates only specified fields
- `PATCH` with `{ visibility: 'unlisted' }` changes visibility without affecting other fields
- Non-owner receives 403
- Non-existent video receives 404
- Invalid enum value for visibility receives 400

---

### SI-04.3 — Custom Thumbnail Upload Endpoint

**Description:** Create the POST /api/videos/:id/thumbnail endpoint for multipart thumbnail upload. Validate file type, size (max 2MB), and dimensions. Upload to MinIO and update Video entity.

**Technical actions:**

- Install `multer` types if not already: `@types/multer@^4.x`
- Add to `VideosController`:
  ```typescript
  @Post(':id/thumbnail')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
        cb(new BadRequestException('THUMBNAIL_INVALID_TYPE'), false);
      }
      cb(null, true);
    },
  }))
  async uploadThumbnail(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    const channel = await this.channelsService.findByUserId(user.sub);
    const video = await this.videosService.findById(id);
    if (!video || video.channelId !== channel.id) {
      throw new NotFoundException('VIDEO_NOT_FOUND');
    }
    const key = `thumbnails/${id}-custom.${file.mimetype.split('/')[1]}`;
    await this.storageService.uploadFile(key, file.buffer, file.mimetype);
    await this.videosService.updateVideoMetadata(id, { thumbnailUrl: key });
    return { thumbnailUrl: key };
  }
  ```
- Add `MulterModule.register()` to VideosModule if needed
- Create BFF route handler `next-frontend/app/api/videos/[id]/thumbnail/route.ts`:
  - `POST` — reads session, proxies multipart to NestJS
- Create MSW handler for thumbnail upload
- Create integration test

**TD references:** video-management/TD-03 (Dedicated multipart upload endpoint)

**Acceptance criteria:**

- `POST /api/videos/:id/thumbnail` with valid image file returns 200 with thumbnailUrl
- File larger than 2MB returns 413
- Non-image file returns 400
- Non-owner returns 403
- Thumbnail appears in MinIO at correct path

---

### SI-04.4 — PublishedAt Migration and Publish Flow

**Description:** Add `published_at` column to the Video entity, create migration, and implement the publish/unpublish flow via PATCH endpoint.

**Technical actions:**

- Add to `Video` entity:
  ```typescript
  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;
  ```
- Generate migration: `npm run typeorm -- migration:generate -d src/database/data-source.ts src/database/migrations/AddPublishedAtToVideos`
- Add `publishVideo(id, channelId)` and `unpublishVideo(id, channelId)` to `VideosService`:
  - Publish: validate `status === 'ready'`, set `published_at = new Date()`, `visibility = 'public'`
  - Unpublish: set `published_at = null`
- Extend `UpdateVideoDto` to include `published_at` (optional, set to `Date` or `null`)
- Update `VideosService.updateVideo` to handle `published_at` changes
- Update channel public page query to filter `WHERE published_at IS NOT NULL AND visibility = 'public'`

**TD references:** video-management/TD-06 (published_at timestamp)

**Acceptance criteria:**

- `PATCH /api/videos/:id` with `{ published_at: "2026-09-01T12:00:00Z" }` publishes video
- `PATCH` with `{ published_at: null }` unpublishes video
- Video with `status: 'draft'` cannot be published
- Channel page only shows videos with `published_at IS NOT NULL`

---

### SI-04.5 — Channel Update Endpoint and Nickname Validation

**Description:** Create PATCH /api/channels/me endpoint for updating channel name, nickname, and description. Implement nickname uniqueness validation with the existing `[a-z0-9_]` allowlist.

**Technical actions:**

- Create `src/channels/dto/update-channel.dto.ts`:
  ```typescript
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  @MaxLength(50)
  nickname?: string;

  @IsOptional()
  @IsString()
  description?: string;
  ```
- Create `src/channels/channels.controller.ts`:
  ```typescript
  @Patch('me')
  async updateMyChannel(@CurrentUser() user: JwtPayload, @Body() dto: UpdateChannelDto) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    return this.channelsService.updateChannel(channel.id, dto);
  }

  @Public()
  @Get(':nickname')
  async findByNickname(@Param('nickname') nickname: string) {
    return this.channelsService.findByNickname(nickname);
  }
  ```
- Add `updateChannel(id, dto)` and `findByNickname(nickname)` to `ChannelsService`:
  - `updateChannel`: if nickname changed, check uniqueness (case-insensitive), return 409 on conflict
  - `findByNickname`: return channel with subscriber count (0 until Phase 06)
- Register `ChannelsController` in `ChannelsModule`
- Create BFF route handlers:
  - `next-frontend/app/api/channels/me/route.ts` — PATCH (with session)
  - `next-frontend/app/api/channels/[nickname]/route.ts` — GET (public)
- Create MSW handlers for channels
- Create integration tests

**TD references:** video-management/TD-07 (Allow change with uniqueness check)

**Acceptance criteria:**

- `PATCH /api/channels/me` with valid nickname updates the channel
- `PATCH` with duplicate nickname returns 409
- `PATCH` with invalid characters returns 400
- `GET /api/channels/:nickname` returns public channel info
- Non-existent nickname returns 404

---

### SI-04.6 — Channel Dashboard Page (Video List + Frontend)

**Description:** Create the RSC-based channel management dashboard page with video list, search params pagination, and status filtering. Implement the BFF video list endpoint.

**Technical actions:**

- Add to `VideosController`:
  ```typescript
  @Get()
  async findByChannel(
    @CurrentUser() user: JwtPayload,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const channel = await this.channelsService.findByUserId(user.sub);
    return this.videosService.findByChannel(channel.id, {
      cursor, limit: parseInt(limit || '20', 10), status,
    });
  }
  ```
- Add `findByChannel(channelId, opts)` to `VideosService`:
  - ULID cursor-based pagination: `WHERE id < :cursor ORDER BY id DESC`
  - Optional `status` filter
  - Return `{ videos: [...], nextCursor: string | null }`
  - Include `likeCount: 0`, `commentCount: 0` (placeholder — TD-08)
- Create BFF route handler `next-frontend/app/api/videos/route.ts`:
  - `GET` — reads session, proxies to NestJS, forwards query params
- Create dashboard page `next-frontend/app/dashboard/page.tsx`:
  - RSC reads `searchParams.page`, `searchParams.status`
  - Fetches video list via BFF
  - Renders table with columns: thumbnail, title, views, status, published_at, edit link
  - Status filter dropdown (All, Draft, Published, Failed)
  - Pagination via search params
- Create MSW handlers for video list
- Create integration test

**TD references:** video-management/TD-04 (RSC-based dashboard), video-management/TD-08 (placeholder zeros)

**Acceptance criteria:**

- Dashboard page renders with video list for authenticated user
- Status filter works (shows only matching status)
- Pagination works via cursor
- Each row has an "Edit" link
- Like/comment counts show "—" or 0
- Non-authenticated user is redirected to login

---

### SI-04.7 — Channel Public Page (Video Grid + Infinite Scroll)

**Description:** Create the public channel page at /c/[nickname] with channel info, video grid, and cursor-based infinite scroll via LoadMore client component.

**Technical actions:**

- Add to `VideosService`:
  ```typescript
  async findByChannelPublic(channelId: string, opts: { cursor?: string; limit: number }) {
    const qb = this.videoRepository.createQueryBuilder('v')
      .where('v.channel_id = :channelId', { channelId })
      .andWhere('v.status = :status', { status: 'ready' })
      .andWhere('v.published_at IS NOT NULL')
      .andWhere('v.visibility = :visibility', { visibility: 'public' })
      .orderBy('v.published_at', 'DESC')
      .take(opts.limit + 1);
    if (opts.cursor) {
      qb.andWhere('v.published_at < (SELECT published_at FROM videos WHERE id = :cursor)', { cursor: opts.cursor });
    }
    const videos = await qb.getMany();
    return { videos: videos.slice(0, opts.limit), nextCursor: videos.length > opts.limit ? videos[opts.limit - 1].id : null };
  }
  ```
- Add to `ChannelsController`:
  ```typescript
  @Public()
  @Get(':nickname/videos')
  async findChannelVideos(@Param('nickname') nickname: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const channel = await this.channelsService.findByNickname(nickname);
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    return this.videosService.findByChannelPublic(channel.id, { cursor, limit: parseInt(limit || '12', 10) });
  }
  ```
- Create BFF route handler `next-frontend/app/api/channels/[nickname]/videos/route.ts`
- Create channel page `next-frontend/app/c/[nickname]/page.tsx`:
  - RSC fetches channel info + first page of videos
  - Renders channel header (name, description, subscriber count)
  - Renders video grid (4-column grid of VideoCards)
  - Renders `<LoadMore>` client component for infinite scroll
- Create `<LoadMore>` client component:
  - Intersection Observer detects when user scrolls to bottom
  - Fetches next page via cursor
  - Appends videos to grid
- Create `<VideoCard>` presentational component:
  - Thumbnail, title, channel name, view count, published time
- Create MSW handlers
- Create integration test

**TD references:** video-management/TD-05 (RSC with cursor-based infinite scroll)

**Acceptance criteria:**

- Channel page renders at /c/{nickname} with channel info
- Video grid shows published videos only
- Scrolling to bottom loads more videos (infinite scroll)
- First page is server-rendered (SEO-friendly)
- Non-existent channel returns 404
- Anonymous users can view the page

---

### SI-04.8 — Video Edit Page and Channel Settings Page

**Description:** Create the video edit page (accessible from dashboard) and channel settings page. Both use react-hook-form with Zod validation.

**Technical actions:**

- Create video edit page `next-frontend/app/dashboard/videos/[id]/edit/page.tsx`:
  - RSC fetches video by ID
  - Renders `<VideoEditForm>` client component
  - Form fields: title, description, category (dropdown), visibility (public/unlisted)
  - Thumbnail uploader with preview
  - Save button triggers PATCH via BFF
  - Cancel button returns to dashboard
- Create `<VideoEditForm>` client component:
  - `react-hook-form` + `zod` schema
  - Category dropdown fetched from `GET /api/categories`
  - Thumbnail upload via `POST /api/videos/:id/thumbnail`
  - Success → redirect to dashboard
  - Error → display error message
- Create `<ThumbnailUploader>` client component:
  - File input for image selection
  - Preview of selected image
  - Upload button
  - Progress indicator
- Create channel settings page `next-frontend/app/c/[nickname]/settings/page.tsx`:
  - RSC fetches channel info
  - Renders `<ChannelSettingsForm>` client component
  - Form fields: name, nickname, description
  - Nickname field shows validation feedback (invalid characters, taken)
  - Save button triggers PATCH via BFF
- Create `<ChannelSettingsForm>` client component:
  - `react-hook-form` + `zod` schema
  - Nickname field with `[a-z0-9_]` regex validation
  - Success message on save
  - Error display for 409 (nickname taken)
- Create MSW handlers for edit and settings endpoints
- Create integration tests for both forms

**TD references:** video-management/TD-02 (PATCH), video-management/TD-03 (thumbnail), video-management/TD-07 (channel update)

**Acceptance criteria:**

- Video edit page pre-fills with current video data
- Saving changes updates video metadata
- Changing thumbnail uploads and displays new thumbnail
- Channel settings page pre-fills with current channel data
- Changing nickname with duplicate value shows error
- Invalid nickname characters show inline validation error
- Both pages redirect to dashboard on success

---

## Technical Specifications

### Data Model

**Category Entity** (`categories` table)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | integer | PK, auto-increment | Category ID |
| `name` | varchar(50) | NOT NULL | Display name (e.g., "Music", "Gaming") |
| `slug` | varchar(50) | NOT NULL, UNIQUE | URL-safe identifier |
| `display_order` | integer | NOT NULL, default 0 | Sort order |

**Video Entity — new fields** (add to existing `videos` table)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `published_at` | timestamp | nullable | Publication timestamp (TD-06) |

**Channel Entity — existing** (no schema changes; nickname uniqueness enforced by unique constraint)

### API Contracts

**Backend Tier (NestJS)**

| Method | Path | Auth | Description | Status | Body / Response |
|--------|------|------|-------------|--------|-----------------|
| `GET` | `/api/categories` | Public | List all categories | 200 | `[{ id, name, slug }]` |
| `PATCH` | `/api/videos/:id` | JWT | Update video metadata (title, description, category_id, visibility, published_at) | 200 | Partial video body / updated video |
| `POST` | `/api/videos/:id/thumbnail` | JWT | Upload custom thumbnail (multipart) | 200 | `{ thumbnailUrl }` |
| `GET` | `/api/videos?channelId=X&status=&cursor=&limit=` | JWT | List videos for channel dashboard | 200 | `{ videos: [...], nextCursor }` |
| `GET` | `/api/channels/:nickname/videos?cursor=&limit=` | Public | List public videos for channel page | 200 | `{ videos: [...], nextCursor, channel }` |
| `GET` | `/api/channels/:nickname` | Public | Get channel public info | 200 | `{ name, nickname, description, subscriberCount }` |
| `PATCH` | `/api/channels/me` | JWT | Update channel name, nickname, description | 200 | Updated channel |

**BFF Tier (Next.js Route Handlers)**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/categories` | Proxy to NestJS GET /api/categories |
| `PATCH` | `/api/videos/[id]` | Proxy to NestJS PATCH /api/videos/:id |
| `POST` | `/api/videos/[id]/thumbnail` | Proxy to NestJS POST /api/videos/:id/thumbnail |
| `GET` | `/api/videos` | Proxy to NestJS GET /api/videos?channelId=... |
| `GET` | `/api/channels/[nickname]` | Proxy to NestJS GET /api/channels/:nickname |
| `GET` | `/api/channels/[nickname]/videos` | Proxy to NestJS GET /api/channels/:nickname/videos |
| `PATCH` | `/api/channels/me` | Proxy to NestJS PATCH /api/channels/me |

### Authorization Matrix

| Resource | Action | Role | Condition |
|----------|--------|------|-----------|
| Video metadata | Update (PATCH) | Channel owner | Video's `channel_id` matches user's channel |
| Video thumbnail | Upload | Channel owner | Video's `channel_id` matches user's channel |
| Video list (dashboard) | Read | Channel owner | Only returns videos owned by the authenticated channel |
| Channel info | Update (PATCH) | Channel owner | `PATCH /api/channels/me` only for the authenticated user |
| Channel public page | Read | Anonymous | Public — no auth required |
| Channel video list | Read | Anonymous | Only `status: ready` + `published_at IS NOT NULL` + `visibility: public` |

### Error Catalog

| Error code | HTTP status | Description |
|------------|-------------|-------------|
| `CATEGORY_NOT_FOUND` | 404 | Category ID does not exist |
| `VIDEO_NOT_FOUND` | 404 | Video ID does not exist |
| `VIDEO_NOT_OWNER` | 403 | User does not own the video |
| `NICKNAME_ALREADY_TAKEN` | 409 | Channel nickname is already in use |
| `NICKNAME_INVALID` | 400 | Nickname contains invalid characters |
| `CHANNEL_NOT_FOUND` | 404 | Channel nickname not found |
| `THUMBNAIL_TOO_LARGE` | 413 | Thumbnail exceeds 2MB limit |
| `THUMBNAIL_INVALID_TYPE` | 400 | Thumbnail is not a valid image format |

### Frontend Runtime

- **Dashboard page** (`app/dashboard/page.tsx`) — RSC with search params for pagination/filtering. Fetches video list via BFF proxy. Each row links to edit page. _(per video-management/TD-04)_
- **Video edit page** (`app/dashboard/videos/[id]/edit/page.tsx`) — RSC + Client form (react-hook-form) for editing title, description, category, visibility. Thumbnail upload via dedicated upload component. _(per video-management/TD-02, TD-03)_
- **Channel public page** (`app/c/[nickname]/page.tsx`) — RSC with cursor-based infinite scroll via `<LoadMore>` client component. Video grid displays channel videos. _(per video-management/TD-05)_
- **Channel settings page** (`app/c/[nickname]/settings/page.tsx`) — RSC + Client form for editing channel name, nickname, description. Nickname uniqueness validated server-side. _(per video-management/TD-07)_
- **Dashboard enrichment** — View counts, like counts, and comment counts returned as zeros until Phase 06. _(per video-management/TD-08)_

---

## Dependency Map

| SI | Dependencies | Depends on |
|----|-------------|------------|
| SI-04.1 | None (Phase 03 infrastructure) | Phase 03 (MinIO, Redis, Video entity, VideosService) |
| SI-04.2 | SI-04.1 (categories exist for category_id FK) | SI-04.1 |
| SI-04.3 | SI-04.2 (VideosService updateVideoMetadata exists) | SI-04.2 |
| SI-04.4 | SI-04.2 (PATCH endpoint exists) | SI-04.2 |
| SI-04.5 | None (ChannelsService exists from Phase 02) | — |
| SI-04.6 | SI-04.2 (video list endpoint), SI-04.4 (published_at) | SI-04.2, SI-04.4 |
| SI-04.7 | SI-04.4 (published_at filter), SI-04.5 (channel endpoint) | SI-04.4, SI-04.5 |
| SI-04.8 | SI-04.2 (PATCH endpoint), SI-04.3 (thumbnail), SI-04.5 (channel update), SI-04.6 (dashboard) | SI-04.2, SI-04.3, SI-04.5, SI-04.6 |

---

## Deliverables

**Deploy commands:**

```bash
# Backend (already running from Phase 03)
cd nestjs-project
docker compose exec nestjs-api npm run migration:run

# Seed categories
docker compose exec nestjs-api npm run seed

# Frontend (already running from Phase 03)
cd next-frontend
docker compose exec next-frontend npm install
```

**Test commands:**

```bash
# Backend unit + integration
docker compose exec nestjs-api npm test -- --runInBand

# Backend E2E
docker compose exec nestjs-api npm run test:e2e

# Frontend (Vitest)
docker compose exec next-frontend npm test

# TypeScript compilation check
docker compose exec nestjs-api npx tsc --noEmit
docker compose exec next-frontend npx tsc --noEmit

# Lint
docker compose exec nestjs-api npm run lint
docker compose exec next-frontend npm run lint
```