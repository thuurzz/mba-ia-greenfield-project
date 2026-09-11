import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull, Not, FindOptionsWhere } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Video, VideoStatus, VideoVisibility } from './video.entity';
import { VideoView } from './video-view.entity';
import { ulid } from 'ulid';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
    @InjectRepository(VideoView)
    private videoViewRepository: Repository<VideoView>,
    @InjectQueue('video-processing')
    private videoProcessingQueue: Queue,
  ) {}

  async enqueueProcessing(videoId: string): Promise<void> {
    await this.videoProcessingQueue.add(
      'process-video',
      { videoId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: { age: 24 * 3600 },
      },
    );
    this.logger.log(`Enqueued process-video job for ${videoId}`);
  }

  async recordView(videoId: string, ip: string): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await this.videoViewRepository.findOne({
      where: { videoId, ip, viewedAt: MoreThan(since) },
    });
    if (existing) return;
    await this.videoViewRepository.insert({ videoId, ip });
    await this.videoRepository.increment({ id: videoId }, 'viewCount', 1);
  }

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

  async updateVideo(
    id: string,
    channelId: string,
    dto: Partial<Video>,
  ): Promise<Video> {
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
    const qb = this.videoRepository
      .createQueryBuilder('v')
      .where('v.channel_id = :channelId', { channelId })
      .orderBy('v.createdAt', 'DESC')
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

  async findByChannelPublic(
    channelId: string,
    opts: { cursor?: string; limit: number },
  ) {
    const qb = this.videoRepository
      .createQueryBuilder('v')
      .where('v.channel_id = :channelId', { channelId })
      .andWhere('v.status = :status', { status: VideoStatus.READY })
      .andWhere('v.published_at IS NOT NULL')
      .andWhere('v.visibility = :vis', { vis: 'public' })
      .orderBy('v.publishedAt', 'DESC')
      .take(opts.limit + 1);

    if (opts.cursor) {
      const cursorVideo = await this.videoRepository.findOne({
        where: { id: opts.cursor },
      });
      if (cursorVideo?.publishedAt) {
        qb.andWhere('v.published_at < :cursorDate', {
          cursorDate: cursorVideo.publishedAt,
        });
      }
    }

    const videos = await qb.getMany();
    return {
      videos: videos.slice(0, opts.limit),
      nextCursor: videos.length > opts.limit ? videos[opts.limit - 1].id : null,
    };
  }

  async findSuggested(videoId: string, categoryId: number | null, limit = 12) {
    const baseWhere: FindOptionsWhere<Video> = {
      status: VideoStatus.READY,
      publishedAt: Not(IsNull()),
      visibility: VideoVisibility.PUBLIC,
    };
    if (!categoryId) {
      return this.videoRepository.find({
        where: baseWhere,
        order: { publishedAt: 'DESC' as const },
        take: limit,
      });
    }
    const sameCategory = await this.videoRepository.find({
      where: { ...baseWhere, categoryId },
      order: { publishedAt: 'DESC' as const },
      take: limit,
    });
    const filtered = sameCategory.filter((v) => v.id !== videoId);
    if (filtered.length >= 6) return filtered.slice(0, limit);
    const needed = limit - filtered.length;
    const fallback = await this.videoRepository.find({
      where: baseWhere,
      order: { publishedAt: 'DESC' as const },
      take: needed + 1,
    });
    const excludedIds = new Set([videoId, ...filtered.map((v) => v.id)]);
    const fallbackFiltered = fallback
      .filter((v) => !excludedIds.has(v.id))
      .slice(0, needed);
    return [...filtered, ...fallbackFiltered];
  }

  async findHomeVideos(cursor?: string, limit = 20, categoryId?: number) {
    const qb = this.videoRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.channel', 'channel')
      .where('v.status = :status', { status: VideoStatus.READY })
      .andWhere('v.published_at IS NOT NULL')
      .andWhere('v.visibility = :vis', { vis: 'public' })
      .orderBy('v.publishedAt', 'DESC')
      .take(limit + 1);
    if (categoryId)
      qb.andWhere('v.category_id = :catId', { catId: categoryId });
    if (cursor) qb.andWhere('v.id < :cursor', { cursor });
    const videos = await qb.getMany();
    return {
      videos: videos.slice(0, limit),
      nextCursor: videos.length > limit ? videos[limit - 1].id : null,
    };
  }

  async search(query: string, cursor?: string, limit = 20) {
    const qb = this.videoRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.channel', 'channel')
      .where('v.status = :status', { status: VideoStatus.READY })
      .andWhere('v.published_at IS NOT NULL')
      .andWhere('v.visibility = :vis', { vis: 'public' })
      .andWhere('(v.title ILIKE :query OR channel.name ILIKE :query)', {
        query: `%${query}%`,
      })
      .orderBy('v.publishedAt', 'DESC')
      .take(limit + 1);
    if (cursor) qb.andWhere('v.id < :cursor', { cursor });
    const videos = await qb.getMany();
    return {
      videos: videos.slice(0, limit),
      nextCursor: videos.length > limit ? videos[limit - 1].id : null,
    };
  }
}
