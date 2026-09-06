import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Comment } from './comment.entity';
import { CommentLike } from './comment-like.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(CommentLike)
    private commentLikeRepository: Repository<CommentLike>,
  ) {}

  async create(videoId: string, userId: string, body: string, parentId?: number) {
    if (parentId) {
      const parent = await this.commentRepository.findOne({ where: { id: parentId } });
      if (!parent) throw new NotFoundException('COMMENT_NOT_FOUND');
      if (parent.parentId) throw new BadRequestException('NESTING_LIMIT_REACHED');
    }
    const comment = this.commentRepository.create({ videoId, userId, body, parentId: parentId || null });
    return this.commentRepository.save(comment);
  }

  async findByVideo(videoId: string, cursor?: { createdAt: string; id: number }, limit = 20) {
    const where: any = { videoId, parentId: null };
    if (cursor) {
      where.createdAt = LessThan(new Date(cursor.createdAt));
    }
    const comments = await this.commentRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit + 1,
    });
    const hasMore = comments.length > limit;
    const topLevel = comments.slice(0, limit);
    const ids = topLevel.map(c => c.id);
    const replies = ids.length > 0 ? await this.commentRepository.find({
      where: { parentId: ids.length === 1 ? ids[0] : ids as any },
      order: { createdAt: 'ASC' },
    }) : [];
    return {
      comments: topLevel.map(c => ({ ...c, replies: replies.filter(r => r.parentId === c.id) })),
      nextCursor: hasMore ? { createdAt: topLevel[topLevel.length - 1].createdAt.toISOString(), id: topLevel[topLevel.length - 1].id } : null,
    };
  }

  async delete(commentId: number, userId: string) {
    const comment = await this.commentRepository.findOne({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('COMMENT_NOT_FOUND');
    if (comment.userId !== userId) throw new ForbiddenException('COMMENT_NOT_OWNER');
    await this.commentLikeRepository.delete({ commentId });
    await this.commentRepository.delete({ parentId: commentId });
    await this.commentRepository.delete(commentId);
  }

  async toggleCommentLike(commentId: number, userId: string, isLike: boolean) {
    const existing = await this.commentLikeRepository.findOne({ where: { commentId, userId } });
    if (existing) {
      if (existing.isLike === isLike) {
        await this.commentLikeRepository.delete(existing.id);
        await this.commentRepository.decrement({ id: commentId }, isLike ? 'likesCount' : 'dislikesCount', 1);
        return { liked: false };
      }
      await this.commentLikeRepository.update(existing.id, { isLike });
      await this.commentRepository.decrement({ id: commentId }, existing.isLike ? 'likesCount' : 'dislikesCount', 1);
      await this.commentRepository.increment({ id: commentId }, isLike ? 'likesCount' : 'dislikesCount', 1);
      return { liked: true };
    }
    await this.commentLikeRepository.insert({ commentId, userId, isLike });
    await this.commentRepository.increment({ id: commentId }, isLike ? 'likesCount' : 'dislikesCount', 1);
    return { liked: true };
  }
}