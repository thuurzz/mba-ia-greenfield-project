const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module.js');
(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const { StorageService } = require('./dist/videos/storage.service.js');
  const storage = app.get(StorageService);
  const stream = await storage.getFileStream('videos/01M20M3FNTSZVDJ3R0XFKJ6YQ4/hls/master.m3u8');
  const chunks = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  console.log(Buffer.concat(chunks).toString());
  await app.close();
  process.exit(0);
})();
