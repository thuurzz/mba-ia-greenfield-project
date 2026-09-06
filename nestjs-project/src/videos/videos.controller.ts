import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { VideosService } from './videos.service';
import { LikesService } from './likes.service';
import { UpdateVideoDto } from './dto/update-video.dto';
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
    private likesService: LikesService,
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

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVideoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    return this.videosService.updateVideo(id, channel.id, dto);
  }

  @Get()
  async findByChannel(
    @CurrentUser() user: JwtPayload,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    return this.videosService.findByChannel(channel.id, {
      cursor,
      limit: parseInt(limit || '20', 10),
      status,
    });
  }

  @Public()
  @Get('channel/:nickname')
  async findByChannelNickname(
    @Param('nickname') nickname: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const channel = await this.channelsService.findByNickname(nickname);
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    return this.videosService.findByChannelPublic(channel.id, {
      cursor,
      limit: parseInt(limit || '12', 10),
    });
  }

  @Post(':id/view')
  @Public()
  async recordView(@Param('id') id: string, @Req() req: Request) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    await this.videosService.recordView(id, ip);
    return { success: true };
  }

  @Post(':id/like')
  async like(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.likesService.toggleLike(id, user.sub, true);
  }

  @Post(':id/dislike')
  async dislike(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.likesService.toggleLike(id, user.sub, false);
  }

  @Public()
  @Get(':id/likes')
  async getLikes(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.likesService.getLikes(id, user?.sub);
  }

  @Public()
  @Get(':id/suggested')
  async findSuggested(@Param('id') id: string) {
    const video = await this.videosService.findById(id);
    if (!video) throw new NotFoundException('VIDEO_NOT_FOUND');
    return this.videosService.findSuggested(id, video.categoryId);
  }

  @Post(':id/thumbnail')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
        cb(new BadRequestException('THUMBNAIL_INVALID_TYPE'), false);
      }
      cb(null, true);
    },
  }))
  async uploadThumbnail(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    const video = await this.videosService.findById(id);
    if (!video || video.channelId !== channel.id) {
      throw new NotFoundException('VIDEO_NOT_FOUND');
    }
    const ext = file.mimetype.split('/')[1];
    const key = `thumbnails/${id}-custom.${ext}`;
    await this.storageService.uploadFile(key, file.buffer, file.mimetype);
    await this.videosService.updateVideoMetadata(id, { thumbnailUrl: key });
    return { thumbnailUrl: key };
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
