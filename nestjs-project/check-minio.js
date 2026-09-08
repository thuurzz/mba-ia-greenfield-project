const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module.js');
(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const { StorageService } = require('./dist/videos/storage.service.js');
  const storage = app.get(StorageService);
  for (const p of ['videos/01M20M3FNTSZVDJ3R0XFKJ6YQ4/hls/master.m3u8', 'videos/01M20M3FNTSZVDJ3R0XFKJ6YQ4/hls/360p/playlist.m3u8', 'videos/01M20M3FNTSZVDJ3R0XFKJ6YQ4/hls/playlist.m3u8']) {
    console.log(p, '=>', await storage.fileExists(p));
  }
  await app.close();
  process.exit(0);
})();
