import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video, VideoStatus } from './video.entity';
import { ulid } from 'ulid';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
  ) {}

  async createDraft(channelId: string): Promise<Video> {
    const video = this.videoRepository.create({
      id: ulid(),
      channelId,
      status: VideoStatus.DRAFT,
    });
    return this.videoRepository.save(video);
  }

  async findById(id: string): Promise<Video | null> {
    return this.videoRepository.findOne({ where: { id } });
  }

  async updateStatus(id: string, status: VideoStatus): Promise<void> {
    await this.videoRepository.update(id, { status });
  }

  async updateVideoMetadata(id: string, data: Partial<Video>): Promise<void> {
    await this.videoRepository.update(id, data);
  }
}
