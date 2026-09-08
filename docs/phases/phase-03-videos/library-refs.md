# Library References — Phase 03: Upload e Processamento de Vídeos

## `@aws-sdk/client-s3`

**Purpose:** S3 SDK for MinIO/S3 interaction.
**Documentation:** https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/
**Config example:**
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
const client = new S3Client({
  endpoint: 'http://minio:9000',
  region: 'us-east-1',
  credentials: { accessKeyId: '...', secretAccessKey: '...' },
  forcePathStyle: true,
});
```

## `@aws-sdk/s3-request-presigner`

**Purpose:** Generate presigned URLs for temporary file access.
**Example:**
```typescript
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
const url = await getSignedUrl(client, new GetObjectCommand({ Bucket, Key }), { expiresIn: 3600 });
```

## `@tus/server`

**Purpose:** Server-side tus resumable upload protocol support.
**Documentation:** https://github.com/tus/tus-node-server
**Usage:** Extends `@tus/server`'s `DataStore` or configures `TusServer` with custom `create`, `write`, `finish` overrides for MinIO integration.

## `@nestjs/bullmq`

**Purpose:** BullMQ NestJS integration for queue processing.
**Documentation:** https://docs.nestjs.com/techniques/queues
**Config:**
```typescript
BullModule.forRootAsync({
  imports: [ConfigModule],
  inject: [queueConfig.KEY],
  useFactory: (config) => ({ connection: { host: config.redisHost, port: config.redisPort } }),
});
```

## `bullmq`

**Purpose:** Queue library for background video processing.
**Documentation:** https://docs.bullmq.io/
**Usage:** `Worker` class with `@Processor('queue-name')` decorator; `Queue` for job producers.

## `ioredis`

**Purpose:** Redis client for BullMQ.
**Documentation:** https://github.com/luin/ioredis
**Note:** Used transitively by `@nestjs/bullmq`; no direct import needed.

## `ulid`

**Purpose:** ULID generation for video IDs.
**Documentation:** https://github.com/ulid/javascript
**Usage:**
```typescript
import { ulid } from 'ulid';
const id = ulid(); // e.g., "01ARZ3NDEKTSV4RRFFQ69G5FAV"
```

## `hls.js`

**Purpose:** HLS player for the frontend.
**Documentation:** https://github.com/video-dev/hls.js/
**Usage:**
```typescript
import Hls from 'hls.js';
const hls = new Hls();
hls.loadSource(playlistUrl);
hls.attachMedia(videoElement);
```

## `tus-js-client`

**Purpose:** Browser-side tus upload client.
**Documentation:** https://github.com/tus/tus-js-client
**Usage:**
```typescript
import * as tus from 'tus-js-client';
new tus.Upload(file, { endpoint, chunkSize: 5*1024*1024, retryDelays: [0,1000,3000,5000] });
```