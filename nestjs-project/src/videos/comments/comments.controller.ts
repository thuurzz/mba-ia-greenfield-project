import { Controller, Post, Get, Delete, Param, Body, Query, Req, NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { Public } from '../../auth/decorators/public.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/auth.types';
import type { Request } from 'express';

@Controller('videos/:videoId/comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Public()
  @Get()
  async findByVideo(
    @Param('videoId') videoId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedCursor = cursor ? JSON.parse(cursor) : undefined;
    return this.commentsService.findByVideo(videoId, parsedCursor, parseInt(limit || '20', 10));
  }

  @Post()
  async create(
    @Param('videoId') videoId: string,
    @Body() body: { body: string; parentId?: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentsService.create(videoId, user.sub, body.body, body.parentId);
  }

  @Delete(':commentId')
  async delete(
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.commentsService.delete(parseInt(commentId, 10), user.sub);
    return { success: true };
  }

  @Post(':commentId/like')
  async like(
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentsService.toggleCommentLike(parseInt(commentId, 10), user.sub, true);
  }

  @Post(':commentId/dislike')
  async dislike(
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentsService.toggleCommentLike(parseInt(commentId, 10), user.sub, false);
  }
}