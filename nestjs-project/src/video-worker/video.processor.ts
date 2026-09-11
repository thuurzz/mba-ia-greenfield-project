import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video, VideoStatus } from '../videos/video.entity';
import { FfmpegService } from './ffmpeg.service';

@Processor('video-processing')
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(
    private ffmpegService: FfmpegService,
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
  ) {
    super();
  }

  async process(job: Job<{ videoId: string }>): Promise<void> {
    await this.ffmpegService.processVideo(job.data.videoId);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<{ videoId: string }>, err: Error) {
    this.logger.error(
      `Job ${job.id} for video ${job.data.videoId} failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`,
    );
    // Mark as failed only after the final attempt is exhausted
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.videoRepository.update(job.data.videoId, {
        status: VideoStatus.FAILED,
      });
      this.logger.error(`Video ${job.data.videoId} marked as failed`);
    }
  }
}
