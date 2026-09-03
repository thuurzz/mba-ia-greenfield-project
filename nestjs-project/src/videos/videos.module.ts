import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Video } from './video.entity';
import { VideoView } from './video-view.entity';
import { Category } from './category.entity';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { ChannelsModule } from '../channels/channels.module';
import { StorageModule } from './storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Video, VideoView, Category]),
    BullModule.registerQueue({ name: 'video-processing' }),
    ChannelsModule,
    StorageModule,
  ],
  controllers: [VideosController, CategoriesController],
  providers: [VideosService, CategoriesService],
  exports: [VideosService, TypeOrmModule],
})
export class VideosModule {}
