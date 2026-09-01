import {
  Controller,
  Post,
  Get,
  Param,
  Req,
  Res,
  NotFoundException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { VideosService } from './videos.service';
import { ChannelsService } from '../channels/channels.service';
import { StorageService } from './storage.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';

@Controller('videos')
export class VideosController {
  constructor(
    private videosService: VideosService,
    private channelsService: ChannelsService,
    private storageService: StorageService,
  ) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) {
      return {
        statusCode: 404,
        error: 'CHANNEL_NOT_FOUND',
        message: 'User has no channel',
      };
    }
    const video = await this.videosService.createDraft(channel.id);
    return {
      id: video.id,
      uploadUrl: `/api/videos/upload/${video.id}`,
    };
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const video = await this.videosService.findById(id);
    if (!video) {
      return {
        statusCode: 404,
        error: 'VIDEO_NOT_FOUND',
        message: 'Video not found',
      };
    }
    return video;
  }

  @Public()
  @Get(':id/stream/*')
  async stream(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const video = await this.videosService.findById(id);
    if (!video || !video.hlsPlaylistUrl) {
      throw new NotFoundException('Video not found or not ready');
    }

    const splat = req.params[0] || '';
    const key = `videos/${id}/hls/${splat}`;

    try {
      const stream = await this.storageService.getFileStream(key);
      if (splat.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      } else if (splat.endsWith('.ts')) {
        res.setHeader('Content-Type', 'video/MP2T');
      }
      stream.pipe(res);
    } catch {
      res
        .status(404)
        .json({ error: 'FILE_NOT_FOUND', message: 'Stream file not found' });
    }
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const video = await this.videosService.findById(id);
    if (!video || !video.storagePath) {
      throw new NotFoundException('Video not found or not ready');
    }

    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel || channel.id !== video.channelId) {
      res.status(403).json({
        error: 'VIDEO_NOT_OWNER',
        message: 'You do not own this video',
      });
      return;
    }

    const url = await this.storageService.getPresignedUrl(
      video.storagePath,
      3600,
    );
    const filename = video.originalFileName || `${video.id}.mp4`;
    res.json({ downloadUrl: url, filename, expiresIn: 3600 });
  }
}
