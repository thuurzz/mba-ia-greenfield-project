import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  endpoint: process.env.STORAGE_ENDPOINT || 'minio:9000',
  region: process.env.STORAGE_REGION || 'us-east-1',
  accessKey: process.env.STORAGE_ACCESS_KEY,
  secretKey: process.env.STORAGE_SECRET_KEY,
  bucket: process.env.STORAGE_BUCKET || 'streamtube-videos',
  publicBucket: process.env.STORAGE_PUBLIC_BUCKET || 'streamtube-public',
  useSsl: process.env.STORAGE_USE_SSL === 'true' || false,
}));
