import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FfmpegService } from './ffmpeg.service';

@Processor('video-processing')
export class VideoProcessor extends WorkerHost {
  constructor(private ffmpegService: FfmpegService) {
    super();
  }

  async process(job: Job<{ videoId: string }>): Promise<void> {
    await this.ffmpegService.processVideo(job.data.videoId);
  }
}
