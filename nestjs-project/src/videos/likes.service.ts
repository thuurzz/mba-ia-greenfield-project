import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VideoLike } from './video-like.entity';
import { Video } from './video.entity';

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(VideoLike)
    private videoLikeRepository: Repository<VideoLike>,
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
  ) {}

  async toggleLike(videoId: string, userId: string, isLike: boolean) {
    const existing = await this.videoLikeRepository.findOne({ where: { videoId, userId } });
    if (existing) {
      if (existing.isLike === isLike) {
        await this.videoLikeRepository.delete(existing.id);
        await this.videoRepository.decrement({ id: videoId }, isLike ? 'likesCount' : 'dislikesCount', 1);
        return { liked: false, action: 'removed' };
      }
      await this.videoLikeRepository.update(existing.id, { isLike });
      await this.videoRepository.decrement({ id: videoId }, existing.isLike ? 'likesCount' : 'dislikesCount', 1);
      await this.videoRepository.increment({ id: videoId }, isLike ? 'likesCount' : 'dislikesCount', 1);
      return { liked: true, action: 'switched' };
    }
    await this.videoLikeRepository.insert({ videoId, userId, isLike });
    await this.videoRepository.increment({ id: videoId }, isLike ? 'likesCount' : 'dislikesCount', 1);
    return { liked: true, action: 'created' };
  }

  async getLikes(videoId: string, userId?: string) {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    let userReaction: boolean | null = null;
    if (userId) {
      const existing = await this.videoLikeRepository.findOne({ where: { videoId, userId } });
      userReaction = existing ? existing.isLike : null;
    }
    return { likesCount: video?.likesCount || 0, dislikesCount: video?.dislikesCount || 0, userReaction };
  }
}