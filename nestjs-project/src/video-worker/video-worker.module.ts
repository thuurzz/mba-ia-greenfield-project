import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Video } from '../videos/video.entity';
import { VideoProcessor } from './video.processor';
import { FfmpegService } from './ffmpeg.service';
import { StorageModule } from '../videos/storage.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'video-processing' }),
    TypeOrmModule.forFeature([Video]),
    StorageModule,
  ],
  providers: [VideoProcessor, FfmpegService],
})
export class VideoWorkerModule {}
