---
scope_type: phase
related_phases: [3]
status: decided
date: 2026-08-31
scope_description: "Object storage, upload protocol, message queue, video processing worker, streaming strategy, unique video identifiers for Phase 03 — Upload e Processamento de Vídeos"
---
# Technical Decisions — Phase 03: Upload e Processamento de Vídeos

_Subprojects in scope:_

- `nestjs-project/` — upload endpoint, video entity, queue producer, FFmpeg worker, storage client, streaming endpoint, download endpoint
- `next-frontend/` — upload UI with progress, video player, download button. Upload protocol decision affects both sides; streaming protocol affects frontend player selection.

---

## TD-01: Object Storage Service

**Scope:** Cross-layer

**Capability:** Serviço de armazenamento de arquivos (vídeos e thumbnails)

**Context:** Phase 03 needs persistent storage for video files (up to 10GB each) and thumbnails. The architecture diagram shows "Object Storage (S3/MinIO)" as a container. Currently the project has no object storage — only PostgreSQL. The choice determines which Docker service to add, the NestJS client SDK, and the upload/streaming path.

**Options:**

### Option A: MinIO (self-hosted, S3-compatible)

- Open-source S3-compatible object store. Runs as a Docker container in the `nestjs-project/compose.yaml` stack. Same API as AWS S3, so the backend can use the official AWS SDK (`@aws-sdk/client-s3`) or the NestJS-specific `@nestjs/s3` wrapper. In production, swap MinIO for AWS S3 with zero code changes (just env vars: endpoint, region, credentials).
- **Pros:** S3 API is the de facto standard — any S3-compatible SDK works. Zero external cost. Runs locally in Docker, no internet dependency for dev. Same credentials/endpoint pattern in dev and prod (swap endpoint URL). Full control over data — no vendor lock-in during development. Battle-tested for dev/test environments.
- **Cons:** Requires `compose.yaml` update (new service: `minio`, console on port 9001, API on 9000). Slightly more Docker resource usage (~200MB RAM). Must manage data persistence/backup yourself.

### Option B: AWS S3 (cloud-only)

- Use actual AWS S3 from day one. In dev, point to a real S3 bucket (or use S3's `--endpoint-url` with MinIO for parity, but that's Option A with extra steps). The SDK is identical.
- **Pros:** Production-ready from start. Managed durability (11 9s), replication, lifecycle policies. No local Docker resource usage.
- **Cons:** **Requires AWS account and internet for development** — breaks offline dev. Real S3 costs scale with storage (GB/month) and PUT/GET requests. One misconfigured public bucket leaks all videos. Dev/Prod endpoint divergence (real S3 vs MinIO) adds env complexity. Credential management in dev (IAM keys). No advantage over MinIO until production deployment — the SDK is the same.

### Option C: Local filesystem (disk storage)

- Store videos directly on the NestJS server's filesystem. Serve via Express static files or a dedicated download endpoint. No external storage service.
- **Pros:** Simplest initial setup — zero infrastructure. No Docker service, no SDK. Fastest read/write (local I/O).
- **Cons:** **Does not scale** — videos are tied to one server, cannot be served from CDN. **Lossy on container restart** unless a named volume is configured. **No streaming optimization** — cannot use range-request-aware object storage for efficient video serving. **Backup/durability** is manual. **Architecture mismatch** — the C4 diagram explicitly calls for Object Storage. **Migration pain later** — every file must be moved to S3/MinIO. Fails the cross-component test: forces proxy-based streaming instead of presigned URLs, affecting frontend player design.

**Recommendation:** **Option A (MinIO)** — S3-compatible API means the same SDK works in dev and prod. Zero external cost, works offline, full control. Add to `compose.yaml` as a new service alongside `db` and `mailpit`. The backend uses `@aws-sdk/client-s3` (available as `@nestjs/s3` for NestJS DI integration). Production swap to AWS S3 is a credentials-only change.

**Decision:** _A_

---

## TD-02: Upload Protocol

**Scope:** Cross-layer

**Capability:** Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance

**Context:** The project requires uploading files up to 10GB without blocking the server or losing progress on connection drop. The upload protocol is a cross-layer decision: the backend must accept the upload, the frontend must implement the client side, and the storage layer receives the final file.

**Options:**

### Option A: tus (resumable upload protocol)

- Open protocol (tus.io) for resumable file uploads over HTTP. Client sends `POST` to create an upload resource, then `PATCH` with `Upload-Offset` to send chunks. Supports pause/resume across network drops. Backend implementation in NestJS via `@tus/server` or custom handler. Frontend via `tus-js-client` browser library.
- **Pros:** **Resumable by design** — connection drop mid-upload resumes from last byte, critical for 10GB files on unstable connections. **Standard protocol** — works across languages, not tied to AWS. **Progress tracking** — `Upload-Offset` header gives exact byte progress. **Pause/resume** — user can pause and resume later. **Chunked** — uploads in configurable chunks, never holding 10GB in memory. **NestJS-friendly** — `@tus/server` integrates with Express.
- **Cons:** Adds two npm dependencies (`@tus/server`, `tus-js-client`). Requires server-side upload URL creation endpoint. Protocol adds metadata overhead per chunk. Non-trivial to integrate with existing NestJS multipart pipeline. Chunks stored temporarily before final assembly.

### Option B: Presigned S3 URLs (direct-to-S3 upload)

- Backend generates a presigned URL (temporary, signed) that the frontend uses to upload directly to MinIO/S3. The file never passes through the NestJS server — it goes straight from browser to storage. For 10GB, the client uploads in multiple parts via S3's Multipart Upload API.
- **Pros:** **Zero server-side bandwidth** — NestJS only generates the URL, never touches file bytes. **Multipart Upload** — S3 API supports parallel parts, retry per part, pause/resume (composable). **Presigned URL expiry** — self-expiring, no orphan uploads. **Lowest memory footprint** on backend. **Industry pattern** for large file uploads.
- **Cons:** **Frontend needs S3 SDK** (`@aws-sdk/client-s3` on the browser) — adds bundle size (~30KB gzipped). **Presigned URL management** — one URL per part for multipart, potentially hundreds for a 10GB upload. **No centralized upload tracking** — backend cannot track progress unless client reports it. **CORS configuration** needed on MinIO/S3 to allow browser uploads. **File must be assembled in storage** — S3 Multipart Upload requires explicit `CompleteMultipartUpload` call. **Credentials exposure risk** if presigned URL generation logic is misconfigured.

### Option C: Traditional multipart/form-data with NestJS streaming

- Standard HTML `<form>` with `enctype="multipart/form-data"` sent to a NestJS endpoint. Use `FileInterceptor` + `Multer` to receive the file as a stream. Pipe the stream directly to MinIO/S3 using the S3 SDK's `Upload` command (which supports streams).
- **Pros:** Simplest implementation — NestJS and Multer handle multipart parsing natively. No additional frontend library beyond standard `fetch`. Well-documented NestJS pattern. Pipe-to-S3 avoids local disk storage.
- **Cons:** **Not resumable** — connection drop loses all progress. Full 10GB upload ties up a server connection for the duration. Multer buffering risks OOM on large files (mitigated by `limits.fileSize` and stream-to-S3, but the TCP connection remains open). **No progress** from NestJS to client without custom Websocket/SSE — the client only knows "sent" vs "done". **Single-server bottleneck** for all upload traffic.

**Recommendation:** **Option A (tus)** — Resumability is the decisive factor for 10GB files on real-world networks. `@tus/server` integrates with Express/NestJS, `tus-js-client` gives the browser pause/resume. The temporary chunk storage can be a temp directory or a dedicated MinIO bucket. Option B is a close second and may be revisited if the team prefers zero-server-bandwidth; the migration from tus to presigned is a frontend + one endpoint change, not an architecture rebuild.

**Decision:** _A_

---

## TD-03: Message Queue

**Scope:** Backend

**Capability:** Serviço de processamento em segundo plano (filas)

**Context:** After upload completes, a video processing job must run (FFmpeg: extract metadata, generate thumbnail, transcode for streaming). The user should not wait for this processing — it must happen asynchronously in a background worker. A message queue decouples the API from the worker. The architecture diagram mentions "Message Queue (TBD)".

**Options:**

### Option A: BullMQ (Redis-backed)

- BullMQ is a NestJS-native queue library built on Redis. Provides `@nestjs/bullmq` with `Queue`, `Worker`, `QueueEvents`. Jobs are persisted in Redis. Supports delayed jobs, retries, concurrency control, and job progress reporting. NestJS decorators: `@Processor()`, `@Process()`.
- **Pros:** **First-class NestJS integration** — `BullModule.forRoot()`, `BullModule.registerQueue()`, injectable queues and workers. **Job progress** — worker can report progress percentage that the API poll or events can read. **Retry + backoff** built in. **Job events** — `completed`, `failed`, `progress` observable via `QueueEvents`. **No additional service** if Redis is used for other purposes (caching, rate limiting store). Active maintenance (~2M weekly downloads). **Graceful shutdown** — BullMQ waits for running jobs.
- **Cons:** **Requires Redis** — a new Docker service (`compose.yaml`). Redis memory usage grows with job backlog. Job persistence limited by Redis memory (not durable like a DB). Complex job patterns (priority, delayed) need Redis configuration.

### Option B: RabbitMQ

- AMQP-based message broker. NestJS integration via `@nestjs/microservices` with `ClientsModule` and `RabbitMQ` transport. Supports exchanges, routing keys, and durable queues.
- **Pros:** **Durable by default** — messages survive broker restart. **Mature, battle-tested** in enterprise. **Flexible routing** via exchanges (fanout, direct, topic) — overkill for a single queue but extensible. **Admin UI** — management plugin at port 15672.
- **Cons:** **Heavier than Redis** in resource usage (~200MB for RabbitMQ vs ~50MB for Redis). **Less NestJS-idiomatic** — `@nestjs/microservices` RabbitMQ transport is designed for service-to-service messaging, not job queues. **No built-in `Worker` pattern** — must manually implement ack/reject, retry, concurrency. **No job progress reporting** — would need a separate channel. **No `QueueEvents`** pattern. Adds cognitive overhead of exchange/binding/routing-key concepts for a single-queue use case.

### Option C: In-process / immediate worker (no queue)

- After upload completes, a NestJS service calls FFmpeg directly (spawned as a child process) in the same request context or fire-and-forget via `@Transactional()` + event emitter. No external queue infrastructure.
- **Pros:** **Zero infrastructure** — no Redis, no RabbitMQ, no new Docker service. **Simplest initial setup** — one method call. No job serialization/deserialization.
- **Cons:** **Blocks the API process** — FFmpeg spawn ties up NestJS event loop for seconds (metadata extraction) to minutes (transcoding). **No retry** — if the process fails, the job is lost. **No concurrency control** — multiple uploads spawn N FFmpeg processes, starving the API. **No persistence** — restart during processing loses the job. **Does not scale** — cannot add dedicated worker containers. **Architecture mismatch** — the C4 diagram explicitly calls for Message Queue + Video Worker.

**Recommendation:** **Option A (BullMQ + Redis)** — NestJS-native, idiomatic, provides job progress reporting and retry. Redis is lightweight (~50MB RAM, vs RabbitMQ's ~200MB) and can serve future caching needs (rate limiting store, session cache in Phase 06+). The `@nestjs/bullmq` decorators (`@Processor`, `@Process`) mirror NestJS conventions. RabbitMQ is overkill for a single video-processing queue; in-process is disqualified for blocking the API and losing jobs on failure.

**Decision:** A

---

## TD-04: Video Processing Worker — FFmpeg Output Format

**Scope:** Backend

**Capability:** Transversal — covers: "Processamento automático do vídeo após upload (extração de duração e metadados)", "Reprodução via streaming (sem necessidade de download completo)", "Download do vídeo pelo usuário"

**Context:** After upload, the video worker must extract metadata (duration, resolution, codec), generate a thumbnail, and produce a streamable format. The output format determines the player technology, storage footprint, and streaming quality.

**Options:**

### Option A: HLS (HTTP Live Streaming) with multiple quality variants

- FFmpeg transcodes the uploaded video into HLS segments (`.ts` files) with a master playlist (`.m3u8`). Multiple resolutions are generated from the source (e.g., 1080p, 720p, 480p, 360p). The frontend uses `hls.js` (or native Safari HLS support) to play. ABR (adaptive bitrate) selects the best quality for the connection.
- **Pros:** **Adaptive bitrate** — users on slow connections get lower quality without buffering. **Industry standard** — all major players support HLS (hls.js, native Safari, Android ExoPlayer). **Segment-based caching** — CDN-friendly, each segment is a separate file. **FFmpeg** has mature `hls` muxer. **Progressive download** works too — the original file is stored for download, HLS is for streaming. **Subtitles/alternative audio** can be added later.
- **Cons:** **Transcoding is CPU-intensive** — converting a 4K video to 4 HLS variants can take 10-30 minutes for a 1-hour video. **Storage multiplies** — 4 quality variants × ~same size as original in bits (lower resolution but more I-frames). **hls.js dependency** on frontend (IF not using native Safari). **Segment naming/cleanup** needs management.

### Option B: Progressive download (no transcoding)

- Store the original file only. Serve via presigned S3 URL or NestJS proxy with `Range` header support. The browser's `<video>` element plays the file directly if the codec is compatible (H.264 MP4). No FFmpeg processing beyond metadata extraction.
- **Pros:** **Zero transcoding cost** — store once, serve once. **Simplest pipeline** — upload → store → serve. **No FFmpeg complexity** beyond metadata extraction. **No player dependency** — native `<video>` works. **Smallest storage footprint** — one file per video.
- **Cons:** **No adaptive bitrate** — users on slow connections buffer on high-bitrate files. **Codec compatibility** — if user uploads AV1 or VP9, some browsers cannot play. **Seeking** — `<video>` with `Range` requests seeks the full file, requiring server-side byte-range support and adding latency. **Large initial buffering** — browser downloads from byte 0, progressive download means watching while downloading; for a 10GB file, the browser cannot "skip to end" quickly. **No thumbnail scrubbing** in the player timeline.

### Option C: DASH (Dynamic Adaptive Streaming over HTTP)

- Similar to HLS but using MPEG-DASH standard. Uses `.mpd` manifest and `.m4s` segments. FFmpeg supports `dash` muxer. Player options include `dash.js` or `hls.js` (which handles both).
- **Pros:** **Standardized (ISO)** — MPEG-DASH is the international standard. **Codec-agnostic** — HLS is H.264-focused by convention, DASH works with any codec. **Multiple audio tracks** support natively.
- **Cons:** **Less browser support** than HLS — Safari does not support DASH natively (requires dash.js). **More complex manifests** than HLS. **Smaller ecosystem** — dash.js has fewer contributors than hls.js. **FFmpeg `dash` muxer** works, but the `hls` muxer is more battle-tested. HLS covers the same use cases with wider player support.

**Recommendation:** **Option A (HLS with multiple quality variants)** — Adaptive bitrate is critical for a video platform serving diverse connection qualities. HLS is the most widely supported streaming format across browsers (hls.js for Chrome/Firefox, native for Safari/iOS). The CPU cost of transcoding is acceptable for a background worker (the user does not wait). Storage multiplication is a known cost of any multi-quality streaming service. DASH offers no practical advantage over HLS for this project's target browsers. The original uploaded file is preserved in MinIO for download (TD-01).

**Decision:** _A_

**Renders in:** ui-contracts

---

## TD-05: Thumbnail Generation Strategy

**Scope:** Backend

**Capability:** Geração automática de thumbnail a partir de um frame do vídeo

**Context:** After processing, the system must generate a thumbnail image for each video. Thumbnail is used in grids (home page, channel page), suggestions, and search results. Must be generated automatically from a video frame (no manual upload required), but the user may upload a custom thumbnail later (Phase 04).

**Options:**

### Option A: FFmpeg frame extraction at worker time

- During video processing (TD-04), the BullMQ worker runs FFmpeg to extract a frame at a configurable timestamp (e.g., at 30% of duration or at the scene with most motion). Save as JPEG or WebP in MinIO. Store thumbnail URL in the video entity.
- **Pros:** **Zero additional infrastructure** — same FFmpeg call, same worker. **Configurable timestamp** — can pick mid-point, first scene, or user-specified (Phase 04). **Re-runnable** — can regenerate thumbnail on demand. **Multiple formats** — JPEG for compatibility, WebP for smaller size (Phase 04+).
- **Cons:** **Static frame** — may not be the "best" visual for the video. Blind timestamp selection can produce a blank/black frame. Mitigation: scene-detection filter (`ffmpeg select='gt(scene,0.4)'`) adds complexity but improves quality.

### Option B: Thumbnail as HLS snapshot (on the fly)

- Store no thumbnail. The frontend uses the first frame of the HLS video as the thumbnail (seeks to position 0 or uses `#EXT-X-KEY` to grab a frame). Or the frontend requests a thumbnail endpoint that snapshots from the pre-signed source.
- **Pros:** **Zero storage** for thumbnails. Always reflects the actual video content.
- **Cons:** **No placeholder** for unprocessed videos. **Server overhead** — generating on every request is expensive. **Caching required** to avoid per-request FFmpeg calls. **Frontend complexity** — seeking into HLS for a thumbnail requires `hls.js` API knowledge. **SEO unfriendly** — `<meta property="og:image">` cannot point to a dynamic endpoint.

### Option C: AI / Lambda-based scene detection

- Use a dedicated service (AWS Rekognition, Google Video Intelligence) or a Lambda function to analyze the video and select the best thumbnail frame.
- **Pros:** **Best thumbnail quality** — scene analysis picks the most representative frame. **No blind timestamp** — avoids the "black frame" problem.
- **Cons:** **External dependency** (API cost, latency). **Lambda invocation** adds infrastructure. **Overkill** for a MVP — the platform needs any thumbnail, not the perfect one. Can be added in Phase 07/optimization.

**Recommendation:** **Option A (FFmpeg frame extraction** — Simple, zero extra infrastructure, configured within the existing BullMQ worker. Scene-detection filter (`select='gt(scene,0.4)'`) improves quality without adding services. Thumbnail stored as WebP in MinIO for small file size, with a JPEG fallback for og:image.

**Decision:** _A_

---

## TD-06: Unique Video Identifier Format

**Scope:** Cross-layer

**Capability:** URL única por vídeo, sem conflito com outros vídeos

**Context:** Each video needs a unique, URL-safe identifier that becomes part of the watch URL (e.g., `/watch/abc123xyz`). The ID must never collide, be URL-safe, and ideally be sortable by creation time (for ordering). It is used in the database primary key (or as a separate `slug` column), storage paths in MinIO, and public URLs.

**Options:**

### Option A: ULID (Universally Unique Lexicographically Sortable Identifier)

- 26-character, Crockford Base32-encoded identifier. Time-ordered: the first 10 chars are a millisecond timestamp, the remaining 16 are random. Example: `01ARZ3NDEKTSV4RRFFQ69G5FAV`. URL-safe, no special characters. Sortable by creation time.
- **Pros:** **Sortable** — videos ordered by creation time without a separate `created_at` index. **26 chars** — compact, fits in URLs. **No collision risk** — 128 bits of randomness after the timestamp. **No DB dependency** — generated in application code. **Readable** — timestamp prefix helps debugging. **TypeORM-compatible** — stored as `varchar(26)` or `char(26)` with a custom transformer.
- **Cons:** Slightly longer than UUID v4 (26 vs 36 chars — both URL-safe). Not a native PostgreSQL type (must store as string). Requires an npm package (`ulid`) or inline implementation (~20 LOC).

### Option B: UUID v4 (random 128-bit UUID)

- 36-character hex string: `550e8400-e29b-41d4-a716-446655440000`. URL-safe with hyphens. Random, no sort order. PostgreSQL native `uuid` type with `gen_random_uuid()` default.
- **Pros:** **PostgreSQL native** — `uuid` column type, index-friendly, `gen_random_uuid()` default. **No extra package** — Node.js `crypto.randomUUID()`. **Universally understood** by all developers.
- **Cons:** **Not sortable** — no creation-time ordering. **36 chars** including hyphens — longer URL. **Index fragmentation** — random UUIDs cause B-tree index fragmentation in PostgreSQL (worse for large tables). **Hyphens in URL** — minor aesthetics concern.

### Option C: NanoID (compact URL-safe ID)

- Customizable-length URL-safe ID using a 64-character alphabet. Default 21 chars: `V1StGXR8_Z5jdHi6B-myT`. URL-safe, no hyphens needed (uses `_` and `-`). No timestamp component.
- **Pros:** **Shortest** — 21 chars at 126 bits of entropy. **Customizable** — can increase length for more entropy. **URL-safe** — no special characters. **Zero dependencies** — 130 LOC, can vendor inline.
- **Cons:** **Not sortable** — purely random. **No standard PostgreSQL type** — must store as `varchar`. **Less universally known** than UUID. **Shorter but less entropy per char** — 64-alphabet vs ULID's 32-alphabet means case-sensitivity (nanoid v3 uses A-Za-z0-9_-).

**Recommendation:** **Option A (ULID)** — Sortability is valuable for ordering video lists (home page, channel page) without an extra index on `created_at`. 26 chars are compact. The ULID prefix includes the timestamp, which helps debugging (you can read "when was this ID generated" from the ID alone). Store as `varchar(26)` in TypeORM with a custom value transformer. UUID v4 does not sort; NanoID does not sort and is less standard.

**Decision:** _A_

---

## TD-07: Draft Video Creation Strategy

**Scope:** Backend

**Capability:** Pré-cadastro automático do vídeo como rascunho ao iniciar o upload

**Context:** When the user starts an upload, the system must create a video record before the file is fully transferred. This record serves as a placeholder ("draft") that tracks upload progress, links the future file to the right user/channel, and provides the video ID needed for the upload URL.

**Options:**

### Option A: Create draft on upload initiation (tus creation + DB insert)

- When the client calls `POST /api/videos/upload` (BFF) → upstream `POST /api/videos`, backend creates `Video` entity in `status: draft`, generates ULID, stores in PostgreSQL, returns video ID. Client uses this ID in tus upload creation metadata. After upload + FFmpeg processing complete, status transitions to `ready`.
- **Pros:** Upload URL tied to known DB record from byte 0. User sees video in dashboard immediately as "processing/draft". Easy retry of failed uploads. Progress tracking updates same record.
- **Cons:** One extra DB write on upload initiation. Orphan drafts if user aborts (cleanup job needed).

### Option B: Create record only after upload + processing

- Upload to temp MinIO path with temp ID. Only after FFmpeg completes, create Video record and move file to final path.
- **Pros:** No orphan records. Single DB write at end.
- **Cons:** User cannot see video during processing. Temp cleanup still needed. No ULID until processing completes. Upload must restart if processing fails.

**Recommendation:** **Option A (Create draft on upload initiation)** — User expects "Uploading..." and "Processing..." states immediately. Draft records enable dashboard visibility, retry, and progress tracking. Orphan cleanup is simple scheduled job.

**Decision:** _[pending]_

---

## Decisions Summary

| ID    | Scope       | Decision                                 | Recommendation                                       | Choice |
| ----- | ----------- | ---------------------------------------- | ---------------------------------------------------- | ------ |
| TD-01 | Cross-layer | Object Storage Service                   | **A** (MinIO)                                  | _A_  |
| TD-02 | Cross-layer | Upload Protocol                          | **A** (tus resumable upload)                   | _A_  |
| TD-03 | Backend     | Message Queue                            | **A** (BullMQ + Redis)                         | _A_  |
| TD-04 | Backend     | Video Processing Worker — Output Format | **A** (HLS with multi-quality variants)        | _A_  |
| TD-05 | Backend     | Thumbnail Generation Strategy            | **A** (FFmpeg frame extraction at worker time) | _A_  |
| TD-06 | Cross-layer | Unique Video Identifier Format           | **A** (ULID)                                   | _A_  |
| TD-07 | Backend     | Draft Video Creation Strategy            | **A** (Create draft on upload initiation)      | A      |

## New Dependencies

| Package                | Version | Purpose                                   |
| ---------------------- | ------- | ----------------------------------------- |
| `@aws-sdk/client-s3` | ^3.x    | S3 SDK for MinIO/S3 interaction           |
| `@nestjs/s3`         | ^1.x    | NestJS wrapper for S3                     |
| `@tus/server`        | ^1.x    | Server-side tus protocol support          |
| `tus-js-client`      | ^4.x    | Browser-side tus upload client (frontend) |
| `@nestjs/bullmq`     | ^11.x   | BullMQ NestJS integration                 |
| `bullmq`             | ^5.x    | Queue library                             |
| `ioredis`            | ^5.x    | Redis client                              |
| `ulid`               | ^3.x    | ULID generation                           |
| `hls.js`             | ^1.x    | HLS player (frontend)                     |

## New Docker Services

| Service   | Image              | Purpose                      |
| --------- | ------------------ | ---------------------------- |
| `minio` | `minio/minio`    | S3-compatible object storage |
| `redis` | `redis:7-alpine` | BullMQ queue backend         |

## Files to Create/Modify

| File                                             | Action | Purpose                                                       |
| ------------------------------------------------ | ------ | ------------------------------------------------------------- |
| `compose.yaml`                                 | Modify | Add MinIO, Redis services                                     |
| `src/config/storage.config.ts`                 | Create | MinIO/S3 connection config with`registerAs('storage', ...)` |
| `src/config/queue.config.ts`                   | Create | Redis/BullMQ config with`registerAs('queue', ...)`          |
| `src/videos/videos.module.ts`                  | Create | Video module                                                  |
| `src/videos/videos.entity.ts`                  | Create | Video entity schema                                           |
| `src/videos/videos.controller.ts`              | Create | Upload, download, stream endpoints                            |
| `src/videos/videos.service.ts`                 | Create | Business logic                                                |
| `src/videos/upload.service.ts`                 | Create | tus upload handling                                           |
| `src/videos/storage.service.ts`                | Create | MinIO/S3 read/write operations                                |
| `src/video-worker/video-worker.module.ts`      | Create | Worker module                                                 |
| `src/video-worker/video.processor.ts`          | Create | BullMQ processor (FFmpeg)                                     |
| `next-frontend/components/upload/`             | Create | Upload component with tus-js-client                           |
| `next-frontend/app/api/videos/upload/route.ts` | Create | BFF upload route                                              |
