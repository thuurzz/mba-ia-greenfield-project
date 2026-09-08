const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module.js');
(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const { FfmpegService } = require('./dist/video-worker/ffmpeg.service.js');
  const ffmpeg = app.get(FfmpegService);
  await ffmpeg.processVideo('01M20M3FNTSZVDJ3R0XFKJ6YQ4');
  console.log('DONE');
  await app.close();
  process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
