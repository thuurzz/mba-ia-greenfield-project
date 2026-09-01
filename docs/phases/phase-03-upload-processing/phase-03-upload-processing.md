---
kind: phase
name: phase-03-upload-processing
test_specs_aware: true
sources_mtime:
  docs/phases/phase-03-upload-processing/context.md: "2026-08-31 23:09:58.569671908 -0300"
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

# Phase 03 — Upload e Processamento de Vídeos

## Objective

Deliver the complete video upload and processing pipeline — chunked resumable upload of files up to 10GB via the tus protocol, automatic storage in MinIO (S3-compatible), background video processing with FFmpeg (HLS transcoding to multiple quality variants, thumbnail extraction, metadata extraction), and HLS streaming playback with adaptive bitrate.

---

## Step Implementations

### SI-03.1 — Dependencies, Configuration Namespaces, and Docker Compose (MinIO + Redis)

**Description:** Install all Phase 03 production dependencies, create `storage` and `queue` config namespaces following the `registerAs` pattern, extend the Joi validation schema, and add MinIO and Redis services to Docker Compose.

**Technical actions:**

- Install production dependencies in `nestjs-project/`: `@nestjs/s3@^1.x`, `@aws-sdk/client-s3@^3.x`, `@tus/server@^1.x`, `@nestjs/bullmq@^11.x`, `bullmq@^5.x`, `ioredis@^5.x`, `ulid@^3.x`
- Install frontend dependencies in `next-frontend/`: `tus-js-client@^4.x`, `hls.js@^1.x`
- Create `src/config/storage.config.ts` — `registerAs('storage', ...)` reading `STORAGE_ENDPOINT` (string, default `'minio:9000'`), `STORAGE_REGION` (string, default `'us-east-1'`), `STORAGE_ACCESS_KEY` (string, required), `STORAGE_SECRET_KEY` (string, required), `STORAGE_BUCKET` (string, default `'streamtube-videos'`), `STORAGE_PUBLIC_BUCKET` (string, default `'streamtube-public'`), `USE_SSL` (boolean, default `false`)
- Create `src/config/queue.config.ts` — `registerAs('queue', ...)` reading `REDIS_HOST` (string, default `'redis'`), `REDIS_PORT` (number, default `6379`), `QUEUE_VIDEO_PROCESSING` (string, default `'video-processing'`)
- Update `src/config/env.validation.ts` — add all new env vars to the Joi schema
- Update `.env.example` with all new variables and Docker Compose-compatible defaults
- Add MinIO service to `nestjs-project/compose.yaml`:
  ```yaml
  minio:
    image: minio/minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: streamtube
      MINIO_ROOT_PASSWORD: streamtube123
      MINIO_BROWSER_REDIRECT_URL: http://localhost:9001
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5
    volumes:
      - minio_data:/data
  ```
- Add Redis service to `nestjs-project/compose.yaml`:
  ```yaml
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
  ```
- Add `volumes: minio_data:` at the bottom of compose.yaml
- Update `nestjs-api` service `depends_on` to include `minio` and `redis` with `condition: service_healthy`

**TD references:** upload-processing/TD-01 (MinIO), upload-processing/TD-03 (BullMQ + Redis)

**Acceptance criteria:**

- Application starts without errors with all new env vars provided
- Starting without `STORAGE_ACCESS_KEY` causes Joi validation error at bootstrap
- MinIO console is accessible at `http://localhost:9001` — login with `streamtube` / `streamtube123`
- Redis is reachable via `docker compose exec redis redis-cli ping` → `PONG`
- All existing tests still pass

---
### SI-03.2 — Video Entity, Migration, and ULID Transformer

**Description:** Create the Video entity with all relevant fields, ULID primary key strategy with TypeORM transformer, and database migration.

**Technical actions:**

- Install `ulid@^3.x` in `nestjs-project/`
- Create `src/videos/ulid-transformer.ts` — TypeORM value transformer:
  ```typescript
  import { ValueTransformer } from 'typeorm';
  export const ulidTransformer: ValueTransformer = {
    to: (value: string) => value,
    from: (value: string) => value,
  };
  ```
- Create `src/videos/video.entity.ts`:
  - `id: string` — primary column, `varchar(26)`, generated client-side via `ulid()`
  - `title: string` — nullable (set after upload; draft has no title)
  - `description: string` — nullable
  - `status: enum('draft', 'uploading', 'processing', 'ready', 'failed')` — default `'draft'`
  - `visibility: enum('public', 'unlisted')` — default `'public'`
  - `categoryId: number` — nullable (Phase 04 adds categories)
  - `channelId: number` — relation to `Channel` entity (NOT NULL)
  - `duration: number` — nullable (seconds, filled after FFmpeg)
  - `thumbnailUrl: string` — nullable
  - `storagePath: string` — nullable (MinIO path after upload complete)
  - `hlsPlaylistUrl: string` — nullable (path to master.m3u8)
  - `originalFileName: string` — nullable
  - `fileSize: number` — nullable (bytes)
  - `mimeType: string` — nullable
  - `viewCount: number` — default `0`
  - `createdAt`, `updatedAt` — standard timestamps
- Create migration: `npm run migration:generate src/database/migrations/CreateVideoEntity`
- Register `Video` in `TypeOrmModule.forFeature([Video])` in VideosModule
- Update `src/database/data-source.ts` entities list if needed

**TD references:** upload-processing/TD-06 (ULID), upload-processing/TD-07 (Draft creation)

**Acceptance criteria:**

- `npx tsc --noEmit` exits with code 0
- Integration test verifies: creating a Video with `status: 'draft'` persists to DB, default values are correct
- Migration runs without errors on a fresh database
- ULID values are lexicographically sortable (timestamp prefix)

---
### SI-03.3 — MinIO Storage Service (S3 Client)

**Description:** Create the StorageService that wraps the S3 SDK for MinIO operations: upload file, download file, delete file, generate presigned URL, and bucket initialization.

**Technical actions:**

- Create `src/videos/storage.service.ts`:
  - Inject `S3Client` via `@nestjs/s3` — configured with `endpoint`, `region`, `credentials`, `forcePathStyle: true` (required for MinIO)
  - `onModuleInit()` — ensure buckets exist (`STORAGE_BUCKET` for videos, `STORAGE_PUBLIC_BUCKET` for thumbnails) via `CreateBucketCommand` + `HeadBucketCommand`
  - `uploadFile(key: string, body: Buffer | Readable, mimeType: string)` — `PutObjectCommand`
  - `uploadFileFromStream(key: string, stream: ReadableStream, size: number, mimeType: string)` — for tus integration
  - `getFileStream(key: string)` — `GetObjectCommand` returning the `Body` stream
  - `getPresignedUrl(key: string, expiresIn?: number)` — `GetObjectCommand` with presign for temporary download URLs
  - `deleteFile(key: string)` — `DeleteObjectCommand`
  - `copyFile(sourceKey: string, destKey: string)` — `CopyObjectCommand`
  - `fileExists(key: string)` — `HeadObjectCommand` (catch `NotFound` → return false)
- Create unit test: `storage.service.spec.ts` — mock S3Client methods
- Create integration test: `storage.service.integration-spec.ts` — connect to MinIO test container

**TD reference:** upload-processing/TD-01 (MinIO)

**Acceptance criteria:**

- Unit test passes with mocked S3Client
- Integration test succeeds against a running MinIO instance
- `uploadFile` + `getFileStream` round-trip returns identical content
- `deleteFile` followed by `fileExists` returns false
- Presigned URL is accessible for a limited time

---
### SI-03.4 — tus Upload Endpoint (Backend)

**Description:** Implement the tus resumable upload protocol on the NestJS backend using `@tus/server`, integrated with MinIO storage for final file assembly and draft video record creation.

**Technical actions:**

- Create `src/videos/tus-upload.service.ts`:
  - Extends `@tus/server`'s `DataStore` or implement a custom `TusServer` configuration
  - Configure `TusServer` with:
    - `path: '/api/videos/upload'`
    - `respectForwardedForHeaders: true`
    - `maxSize: 10 * 1024 * 1024 * 1024` (10GB)
  - Override `create` method:
    - Parse `Upload-Metadata` header for `filename`, `channelId`, `contentType`
    - Call `videosService.createDraft(channelId)` → create Video with `status: 'draft'`, generate ULID
    - Return upload URL with video ID
  - Override `write` method:
    - Stream incoming chunk to a temp MinIO prefix `uploads/{videoId}/`
    - Update `Upload-Offset` tracking
  - Override `finish` method:
    - Move/concatenate chunks to final path `videos/{ulid}/source.mp4`
    - Update Video entity: `storagePath`, `originalFileName`, `fileSize`, `mimeType`, `status -> 'uploading'`
    - Enqueue BullMQ job `process-video` with video ID
- Create `src/videos/videos.service.ts`:
  - `createDraft(channelId)` — creates Video with ULID, `status: 'draft'`
  - `findById(id)` — find video by ULID
  - `updateStatus(id, status)` — update processing status
  - `updateVideoMetadata(id, data)` — update after processing
- Create `src/videos/videos.controller.ts`:
  - `POST /api/videos` — create draft, returns `{ id, uploadUrl }`
  - `HEAD /api/videos/upload/:id` — tus HEAD (get offset)
  - `PATCH /api/videos/upload/:id` — tus PATCH (upload chunk)
  - `OPTIONS /api/videos/upload` — tus OPTIONS (capabilities)
- Create `src/videos/videos.module.ts`:
  - Import `TypeOrmModule.forFeature([Video])`, `BullModule.registerQueue({ name: 'video-processing' })`, `StorageModule`
  - Provide `VideosService`, `TusUploadService`
  - Register `VideosController`
  - Export `VideosService`
- Register `VideosModule` in `AppModule`

**TD references:** upload-processing/TD-02 (tus), upload-processing/TD-07 (Draft creation)

**Acceptance criteria:**

- `POST /api/videos` with valid auth returns `201` with `{ id, uploadUrl }` and creates draft in DB
- `OPTIONS /api/videos/upload` returns tus capabilities including `creation`, `expiration`
- `HEAD /api/videos/upload/:id` returns `Upload-Offset: 0` for new upload
- `PATCH` with chunk updates `Upload-Offset` accordingly
- Upload of a small file completes successfully — status transitions to `'uploading'`, file stored in MinIO
- Upload interrupted and resumed (PATCH with `Upload-Offset`) resumes from correct position
- Upload exceeding 10GB returns `413`

---
### SI-03.5 — Video Upload BFF Route Handler + Frontend Upload UI (tus-js-client)

**Description:** Create the frontend upload experience — BFF route handler that proxies video creation, UploadPage with drag-and-drop, tus-js-client with progress bar, pause/resume support.

**Technical actions:**

- Create `next-frontend/app/api/videos/route.ts` — BFF Route Handler:
  - `POST /api/videos` — reads session, calls upstream `POST /api/videos`, returns `{ id, uploadUrl }`
- Update MSW handlers: `next-frontend/mocks/handlers/videos.ts` — mock upstream responses for video creation
- Create upload page:
  - `next-frontend/app/(upload)/upload/page.tsx` — RSC that renders `<UploadForm />` client component
  - `<UploadForm />` — `"use client"`, uses tus-js-client:
    - File drag-and-drop zone (or file picker)
    - On file select → `POST /api/videos` → get `uploadUrl`
    - Create `tus.Upload` with `uploadUrl`, `chunkSize: 5MB`, `retryDelays: [0, 1000, 3000, 5000]`
    - Listen `onProgress(bytesUploaded, bytesTotal)` → render progress bar
    - Show pause/resume button
    - On error → show error message with retry option
    - On success → redirect to video management page (or show success state)
- Add verification: `components/ui/progress.tsx` — shadcn progress bar (install via CLI if missing)
- Create integration test: `app/api/videos/__tests__/upload.integration.test.ts` — MSW mocks upstream

**TD references:** upload-processing/TD-02 (tus), phase-02-auth-frontend/TD-04 (react-hook-form), phase-02-auth-frontend/TD-05 (Route Handler POST + fetch)

**Acceptance criteria:**

- Upload page renders with drag-and-drop zone and file picker
- Selecting a file triggers video creation and upload start
- Progress bar updates as chunks are uploaded
- Pause/resume works — pausing mid-upload and resuming continues from last offset
- Upload completes successfully with success state displayed
- Integration test verifies BFF flow with MSW
- E2E test verifies full flow (planned — see test specs)

---
### SI-03.6 — BullMQ Queue Configuration and Job Producer

**Description:** Configure BullMQ with Redis connection, register the `video-processing` queue, and create the job producer that enqueues processing jobs after upload completion.

**Technical actions:**

- Create `src/config/queue.config.ts` (if not done in SI-03.1, ensure `registerAs` is properly set up)
- Add `BullModule.forRootAsync` to `AppModule` (or a dedicated `QueueModule`):
  ```typescript
  BullModule.forRootAsync({
    imports: [ConfigModule],
    inject: [queueConfig.KEY],
    useFactory: (config: ConfigType<typeof queueConfig>) => ({
      connection: {
        host: config.redisHost,
        port: config.redisPort,
      },
    }),
  })
  ```
- Register queue in `VideosModule`:
  ```typescript
  BullModule.registerQueue({ name: 'video-processing' })
  ```
- Add `InjectQueue('video-processing')` to `VideosService` or `TusUploadService`
- Enqueue job after upload finishes:
  ```typescript
  await this.videoProcessingQueue.add('process-video', { videoId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
  ```
- Create unit test: verify job is enqueued with correct payload after upload completion
- Create integration test: real Redis connection, verify job lands in queue

**TD reference:** upload-processing/TD-03 (BullMQ + Redis)

**Acceptance criteria:**

- Application starts with Redis connection established
- After upload completes, a `process-video` job appears in the `video-processing` queue
- Job payload contains correct `videoId`
- Queue connection failure does not crash the API (graceful error handling)
- Integration test passes with real Redis

---
### SI-03.7 — Video Worker (FFmpeg — HLS Transcoding, Thumbnail, Metadata)

**Description:** Create the BullMQ worker that consumes `process-video` jobs, runs FFmpeg to extract metadata, generate thumbnail, transcode to HLS with multiple quality variants, and update video entity.

**Technical actions:**

- Create `src/video-worker/video.processor.ts`:
  ```typescript
  @Processor('video-processing')
  export class VideoProcessor {
    @Process('process-video')
    async handleProcessing(job: Job<{ videoId: string }>) { ... }
  }
  ```
- Create `src/video-worker/ffmpeg.service.ts`:
  - `extractMetadata(inputPath: string)` — run `ffprobe` to get duration, resolution, codec, bitrate
  - `generateThumbnail(inputPath: string, outputPath: string)` — FFmpeg scene-detection: `ffmpeg -i {input} -vf "select='gt(scene,0.4)',setpts=N/(2*TB)" -frames:v 1 -q:v 3 {output}`
  - `transcodeToHls(inputPath: string, outputDir: string)` — generate multiple quality variants:
    ```bash
    # 1080p
    ffmpeg -i {input} -vf scale=-2:1080 -c:v libx264 -b:v 5000k -c:a aac -b:a 128k -hls_time 6 -hls_playlist_type vod -hls_segment_filename {outputDir}/1080p/seg-%d.ts {outputDir}/1080p/playlist.m3u8
    # 720p
    ffmpeg -i {input} -vf scale=-2:720 -c:v libx264 -b:v 2500k -c:a aac -b:a 96k -hls_time 6 -hls_playlist_type vod -hls_segment_filename {outputDir}/720p/seg-%d.ts {outputDir}/720p/playlist.m3u8
    # 480p
    ffmpeg -i {input} -vf scale=-2:480 -c:v libx264 -b:v 1000k -c:a aac -b:a 64k -hls_time 6 -hls_playlist_type vod -hls_segment_filename {outputDir}/480p/seg-%d.ts {outputDir}/480p/playlist.m3u8
    # 360p
    ffmpeg -i {input} -vf scale=-2:360 -c:v libx264 -b:v 600k -c:a aac -b:a 48k -hls_time 6 -hls_playlist_type vod -hls_segment_filename {outputDir}/360p/seg-%d.ts {outputDir}/360p/playlist.m3u8
    ```
  - `createMasterPlaylist(outputDir: string, variants: Variant[])` — generate `master.m3u8` referencing all variant playlists
  - Process:
    1. Download source file from MinIO to temp directory
    2. Run `ffprobe` for metadata
    3. Generate thumbnail, upload to `thumbnails/{ulid}.webp` in public bucket
    4. Transcode to HLS variants in temp directory
    5. Upload HLS segments and playlists to `videos/{ulid}/hls/` in MinIO
    6. Upload thumbnail to `thumbnails/{ulid}.webp`
    7. Update Video entity: status `'ready'`, `duration`, `thumbnailUrl`, `hlsPlaylistUrl`, metadata
- Create `src/video-worker/video-worker.module.ts`:
  - Import `BullModule.registerQueue({ name: 'video-processing' })`, `VideosModule`, `StorageModule`
  - Register `VideoProcessor`, `FfmpegService`
- Register `VideoWorkerModule` in `AppModule` (note: worker runs in same NestJS process, or as separate worker process — see Architecture Decision)
- Create unit test: `ffmpeg.service.spec.ts` — mock child_process.spawn
- Create integration test: `video.processor.integration-spec.ts` — real Redis + MinIO + FFmpeg, process a small test video

**TD references:** upload-processing/TD-03 (BullMQ), upload-processing/TD-04 (HLS), upload-processing/TD-05 (Thumbnail)

**Acceptance criteria:**

- Worker processes a small test video file — produces 4 HLS variant playlists + segments
- Master playlist references all variant playlists
- Thumbnail is generated and stored in MinIO
- Video entity is updated with `status: 'ready'`, duration, thumbnail URL, HLS URL
- Failed job retries up to 3 times with backoff
- FFmpeg errors are caught and job is marked as failed
- Metadata extraction returns correct duration and resolution

---
### SI-03.8 — Video Streaming Endpoint (HLS)

**Description:** Create the backend endpoint and BFF route handler for serving HLS playlists and segments from MinIO, enabling adaptive bitrate streaming.

**Technical actions:**

- Add to `VideosController`:
  - `GET /api/videos/:id/stream` — returns video's HLS master playlist URL or redirects to presigned URL for `master.m3u8`
  - `GET /api/videos/:id/stream/playlist.m3u8` — returns master playlist (reads from MinIO, sets `Content-Type: application/vnd.apple.mpegurl`)
  - `GET /api/videos/:id/stream/:variant/seg-:num.ts` — returns `.ts` segment
  - All endpoints verify video visibility: `public` for everyone, `unlisted` via token check
- Create BFF route handler `next-frontend/app/api/videos/[id]/stream/route.ts`:
  - Proxies requests to NestJS streaming endpoints
  - Sets proper `Content-Type` headers
  - Passes through HLS content with cache headers
- Register `VideosModule` exports for streaming

**TD reference:** upload-processing/TD-04 (HLS)

**Acceptance criteria:**

- `GET /api/videos/:id/stream` returns master playlist URL for a `ready` video
- Master playlist content has correct variant playlist references
- Segments are served with correct byte content and content type
- `public` videos are accessible without authentication
- `unlisted` videos require a valid access token
- Not-found video returns `404`
- Browser can load master playlist and start playback (test via curl)

---
### SI-03.9 — Video Download Endpoint

**Description:** Create the download endpoint that returns the original uploaded video file as a downloadable attachment via presigned URL or direct stream.

**Technical actions:**

- Add to `VideosController`:
  - `GET /api/videos/:id/download` — generates a presigned URL for `source.mp4` from MinIO, or streams directly with `Content-Disposition: attachment; filename="..."` header
  - Presigned URL expires after 1 hour
  - Verify video ownership (only the channel owner can download the original file)
- Add to `StorageService`: `getPresignedUrl(key: string, expiresIn: number)` — use `@aws-sdk/s3-request-presigner` `getSignedUrl`
- Create BFF route handler `next-frontend/app/api/videos/[id]/download/route.ts`:
  - Reads session, checks ownership via upstream `/api/videos/:id/download`
  - Returns presigned URL or proxies the stream
- Create download button UI in upload success page (or video management page):
  - Future: download button on video watch page (Phase 05+)

**TD reference:** upload-processing/TD-04 (HLS — source file preserved for download)

**Acceptance criteria:**

- `GET /api/videos/:id/download` returns `Content-Disposition: attachment`
- Only the channel owner receives a valid download response
- Non-owners receive `403 Forbidden`
- Download link expires after 1 hour
- Downloaded file matches the uploaded source (verified by checksum)

---
### SI-03.10 — Frontend HLS Player Component

**Description:** Create an HLS video player component for the frontend using `hls.js` with adaptive bitrate, play/pause, volume, progress bar, and fullscreen controls.

**Technical actions:**

- Install `hls.js@^1.x` in `next-frontend/` (per TD-04)
- Create `components/video/hls-player.tsx` — `"use client"`:
  - Props: `src: string` (master playlist URL), `poster?: string` (thumbnail), `autoplay?: boolean`
  - On mount, create `Hls` instance:
    ```typescript
    const hls = new Hls();
    hls.loadSource(src);
    hls.attachMedia(videoRef.current);
    ```
  - Fallback to native HLS support for Safari (`<video>` with `src` directly)
  - Render native `<video>` element with controls:
    - Play/pause button
    - Volume slider
    - Progress bar (seekable)
    - Fullscreen toggle
    - Current time / duration display
  - Show poster image before playback starts
  - Handle errors: `Hls.ErrorTypes.NETWORK_ERROR` → retry, `MEDIA_ERROR` → recover
  - Clean up HLS instance on unmount
- Create `components/video/__tests__/hls-player.test.tsx` — unit test with mocked Hls.js
- Add component to a test page or integrate into upload success page

**TD reference:** upload-processing/TD-04 (HLS)

**Acceptance criteria:**

- Player renders with poster thumbnail
- Video starts playing when stream URL is provided
- Controls work: play/pause, volume, seek, fullscreen
- Adaptive bitrate switches quality based on network conditions (visible via Hls.js stats)
- Fallback works in Safari with native HLS
- Component handles missing/invalid URL gracefully (shows error state)
- Unit test passes with mocked Hls.js

---

## Technical Specifications

### Data Model

**Video Entity** (`videos` table)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | varchar(26) | PK, NOT NULL, generated via `ulid()` | ULID primary key |
| `title` | varchar(255) | nullable | Video title (set by user after upload) |
| `description` | text | nullable | Video description |
| `status` | enum | NOT NULL, default `'draft'` | `draft`, `uploading`, `processing`, `ready`, `failed` |
| `visibility` | enum | NOT NULL, default `'public'` | `public`, `unlisted` |
| `channel_id` | integer | FK → channels.id, NOT NULL | Owner channel |
| `category_id` | integer | nullable, FK → categories (Phase 04) | Video category |
| `duration` | integer | nullable | Duration in seconds |
| `thumbnail_url` | varchar(500) | nullable | MinIO path to thumbnail |
| `storage_path` | varchar(500) | nullable | MinIO path to source video |
| `hls_playlist_url` | varchar(500) | nullable | MinIO path to master.m3u8 |
| `original_file_name` | varchar(255) | nullable | Original uploaded filename |
| `file_size` | bigint | nullable | File size in bytes |
| `mime_type` | varchar(100) | nullable | Upload MIME type |
| `view_count` | integer | NOT NULL, default `0` | View counter |
| `created_at` | timestamp | NOT NULL, default `now()` | Creation timestamp |
| `updated_at` | timestamp | NOT NULL, default `now()` | Last update timestamp |

**Status lifecycle:** `draft` → `uploading` → `processing` → `ready` (success) / `failed` (failure)

### API Contracts

**Backend Tier (NestJS → MinIO / DB)**

| Method | Path | Auth | Description | Status | Body / Response |
|--------|------|------|-------------|--------|-----------------|
| `POST` | `/api/videos` | JWT | Create draft video | 201 | `{ id: ulid, uploadUrl: string }` |
| `HEAD` | `/api/videos/upload/:id` | JWT | Get upload offset (tus) | 200 | `Upload-Offset` header |
| `PATCH` | `/api/videos/upload/:id` | JWT | Upload chunk (tus) | 204 | Chunk body, `Upload-Offset` response |
| `OPTIONS` | `/api/videos/upload` | — | tus capabilities | 204 | `Tus-Extension`, `Tus-Version`, `Tus-Max-Size` |
| `GET` | `/api/videos/:id/stream/*` | Public | Serve HLS playlist/segments | 200 | HLS content (`.m3u8`, `.ts`) |
| `GET` | `/api/videos/:id/download` | JWT | Download source video | 200 | File stream or presigned URL redirect |
| `GET` | `/api/videos/:id` | Public | Get video metadata | 200 | Video details JSON |

**BFF Tier (Next.js Route Handler → Browser)**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/videos` | Proxy to NestJS POST /api/videos |
| `GET` | `/api/videos/[id]/stream/*` | Proxy to NestJS HLS streaming |
| `GET` | `/api/videos/[id]/download` | Proxy to NestJS download (checks session) |

### Authorization Matrix

| Resource | Action | Role | Condition |
|----------|--------|------|-----------|
| Video (draft) | Create | Authenticated user | — |
| Video (draft) | Upload chunks | Channel owner | Video's `channel_id` matches user's channel |
| Video (any) | Read metadata | Anonymous | `status = 'ready'` AND `visibility = 'public'` |
| Video (unlisted) | Read metadata | Anonymous + valid token | Token parameter in URL |
| Video (ready) | Download source | Channel owner | Video's `channel_id` matches user's channel |
| Video (any) | Stream HLS | Anonymous | `visibility = 'public'` OR valid unlisted token |

### Error Catalog

| Error code | HTTP status | Description |
|------------|-------------|-------------|
| `UPLOAD_TOO_LARGE` | 413 | Upload exceeds 10GB limit |
| `UPLOAD_INVALID_OFFSET` | 409 | PATCH offset does not match server offset |
| `VIDEO_NOT_FOUND` | 404 | Video ID does not exist |
| `VIDEO_NOT_READY` | 400 | Video is still processing |
| `VIDEO_NOT_OWNER` | 403 | User does not own the video |
| `STORAGE_ERROR` | 500 | MinIO/S3 operation failed |
| `PROCESSING_FAILED` | 500 | FFmpeg processing failed |

### Events / Messages

| Event | Producer | Consumer | Payload |
|-------|----------|----------|---------|
| `process-video` | TusUploadService (on upload complete) | BullMQ `video-processing` queue | `{ videoId: string }` |

### Frontend Runtime

- **UploadClient** (`tus-js-client`) — configured with `chunkSize: 5MB`, `retryDelays: [0, 1000, 3000, 5000]`
- **HlsPlayer** (`hls.js`) — configured with `startLevel: -1` (auto), `capLevelToPlayerSize: true`, `maxBufferLength: 30`
- **UploadForm** — `react-hook-form` with file input, drag-and-drop zone, progress bar (shadcn `progress`), pause/resume button, error display
- **Session** — reads `iron-session` cookie via BFF, attaches JWT to tus requests via `tus-js-client` headers option

### UI Contracts

_No screen inventory — UI screens are limited to the upload page and HLS player. Upload page is a standalone feature page; player component is reusable across future phases._

---

## Dependency Map

| SI | Dependencies | Depends on |
|----|-------------|------------|
| SI-03.1 | None (Phase 01 + 02 infrastructure) | Phase 01 (Docker, ConfigModule), Phase 02 (auth, Joi schema) |
| SI-03.2 | SI-03.1 (deps installed) | — |
| SI-03.3 | SI-03.1 (MinIO running, config ready) | — |
| SI-03.4 | SI-03.2 (Video entity), SI-03.3 (StorageService), SI-03.6 (queue for enqueue) | SI-03.2, SI-03.3 |
| SI-03.5 | SI-03.4 (backend upload endpoint) | SI-03.4 |
| SI-03.6 | SI-03.1 (Redis running, deps installed) | — |
| SI-03.7 | SI-03.3 (StorageService for download/upload), SI-03.4 (enqueue on upload), SI-03.6 (queue config) | SI-03.3, SI-03.4, SI-03.6 |
| SI-03.8 | SI-03.7 (HLS files in MinIO), SI-03.3 (streaming from MinIO) | SI-03.7, SI-03.3 |
| SI-03.9 | SI-03.7 (source file in MinIO), SI-03.3 (presigned URL) | SI-03.7, SI-03.3 |
| SI-03.10 | SI-03.8 (streaming endpoint works) | SI-03.8 |

---

## Deliverables

**Deploy commands:**

```bash
# Backend
cd nestjs-project
docker compose up -d                 # Start API, DB, Mailpit, MinIO, Redis
docker compose exec nestjs-api npm install
docker compose exec nestjs-api npm run migration:run
docker compose exec -d nestjs-api npm run start:dev

# Frontend
cd next-frontend
docker compose up -d
docker compose exec next-frontend npm install
docker compose exec -d next-frontend npm run dev
```

**Test commands:**

```bash
# Backend unit + integration
docker compose exec nestjs-api npm test -- --runInBand

# Backend E2E
docker compose exec nestjs-api npm run test:e2e

# Frontend (Vitest)
docker compose exec next-frontend npm test

# Frontend E2E (Playwright — host)
npx playwright test

# TypeScript compilation check
docker compose exec nestjs-api npx tsc --noEmit
docker compose exec next-frontend npx tsc --noEmit

# Lint
docker compose exec nestjs-api npm run lint
docker compose exec next-frontend npm run lint
```

**Verification steps:**

1. Upload a small test video via the upload form — verify progress bar, pause/resume
2. Check MinIO console (http://localhost:9001) — source file exists in `videos/{ulid}/source.mp4`
3. Wait for processing to complete — check BullMQ queue dashboard (or job polling)
4. Verify HLS files created in MinIO at `videos/{ulid}/hls/` with master.m3u8 + variant playlists + segments
5. Play video via streaming endpoint — curl the master playlist, verify all variants present
6. Download video — verify Content-Disposition header and file integrity
7. Run full test suite — no regressions in existing auth tests