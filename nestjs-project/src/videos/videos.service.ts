import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video, VideoStatus } from './video.entity';
import { ulid } from 'ulid';

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

  async updateVideo(id: string, channelId: string, dto: Partial<Video>): Promise<Video> {
    const video = await this.findById(id);
    if (!video) {
      throw new NotFoundException('VIDEO_NOT_FOUND');
    }
    if (video.channelId !== channelId) {
      throw new ForbiddenException('VIDEO_NOT_OWNER');
    }
    await this.videoRepository.update(id, dto);
    return this.findById(id) as Promise<Video>;
  }

  async findByChannel(
    channelId: string,
    opts: { cursor?: string; limit: number; status?: string },
  ): Promise<{ videos: Video[]; nextCursor: string | null }> {
    const qb = this.videoRepository.createQueryBuilder('v')
      .where('v.channel_id = :channelId', { channelId })
      .orderBy('v.created_at', 'DESC')
      .take(opts.limit + 1);

    if (opts.cursor) {
      qb.andWhere('v.id < :cursor', { cursor: opts.cursor });
    }
    if (opts.status) {
      qb.andWhere('v.status = :status', { status: opts.status });
    }

    const videos = await qb.getMany();
    return {
      videos: videos.slice(0, opts.limit),
      nextCursor: videos.length > opts.limit ? videos[opts.limit - 1].id : null,
    };
  }
}