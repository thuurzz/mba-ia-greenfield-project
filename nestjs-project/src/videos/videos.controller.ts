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
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

interface UploadedVideoFile {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
}
import { VideosService } from './videos.service';
import { VideoStatus } from './video.entity';
import { LikesService } from './likes.service';
import { UpdateVideoDto } from './dto/update-video.dto';
import { ChannelsService } from '../channels/channels.service';
import { StorageService } from './storage.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';

@Controller('videos')
@SkipThrottle()
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
      uploadUrl: `${video.id}`,
    };
  }

  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: UploadedVideoFile | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    const video = await this.videosService.findById(id);
    if (!video || video.channelId !== channel.id) {
      throw new NotFoundException('VIDEO_NOT_FOUND');
    }
    if (!file) {
      throw new BadRequestException('FILE_REQUIRED');
    }
    const ext = file.originalname?.split('.').pop() || 'mp4';
    const key = `videos/${id}/source.${ext}`;
    await this.storageService.uploadFile(key, file.buffer, file.mimetype);
    await this.videosService.updateVideoMetadata(id, {
      storagePath: key,
      originalFileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      status: VideoStatus.PROCESSING,
      publishedAt: new Date(),
    });
    await this.videosService.enqueueProcessing(id);
    return {
      success: true,
      id,
      storagePath: key,
      status: VideoStatus.PROCESSING,
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
  @Get('home')
  async findHome(
    @Query('categoryId') categoryId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.videosService.findHomeVideos(
      cursor,
      parseInt(limit || '20', 10),
      categoryId ? parseInt(categoryId, 10) : undefined,
    );
  }

  @Public()
  @Get('search')
  async search(
    @Query('q') q: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.videosService.search(q, cursor, parseInt(limit || '20', 10));
  }

  @Public()
  @Get(':id/suggested')
  async findSuggested(@Param('id') id: string) {
    const video = await this.videosService.findById(id);
    if (!video) throw new NotFoundException('VIDEO_NOT_FOUND');
    return this.videosService.findSuggested(id, video.categoryId);
  }

  @Post(':id/thumbnail')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
          cb(new BadRequestException('THUMBNAIL_INVALID_TYPE'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadThumbnail(
    @Param('id') id: string,
    @UploadedFile() file: UploadedVideoFile | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    const video = await this.videosService.findById(id);
    if (!video || video.channelId !== channel.id) {
      throw new NotFoundException('VIDEO_NOT_FOUND');
    }
    if (!file) {
      throw new BadRequestException('FILE_REQUIRED');
    }
    const ext = file.mimetype.split('/')[1];
    const key = `thumbnails/${id}-custom.${ext}`;
    await this.storageService.uploadFile(key, file.buffer, file.mimetype);
    await this.videosService.updateVideoMetadata(id, { thumbnailUrl: key });
    return { thumbnailUrl: key };
  }

  @Public()
  @Get(':id/thumbnail')
  async thumbnail(@Param('id') id: string, @Res() res: Response) {
    const video = await this.videosService.findById(id);
    if (!video || !video.thumbnailUrl) {
      throw new NotFoundException('Thumbnail not found');
    }
    try {
      const stream = await this.storageService.getFileStream(video.thumbnailUrl);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      stream.pipe(res);
    } catch {
      res.status(404).json({ error: 'FILE_NOT_FOUND', message: 'Thumbnail not found' });
    }
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
  @Get(':id/stream/*splat')
  async stream(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const video = await this.videosService.findById(id);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Express 5 wildcard captures a single segment; parse the full path manually
    const splat = (req.params as Record<string, string>).splat ?? '';
    const rest = req.originalUrl.split(`/stream/`)[1] ?? splat;

    // Fallback: HLS not ready — serve the raw source so playback works while processing
    if (!video.hlsPlaylistUrl) {
      if (!video.storagePath) {
        throw new NotFoundException('Video not ready for streaming');
      }
      try {
        const sourceStream = await this.storageService.getFileStream(
          video.storagePath,
        );
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'none');
        sourceStream.pipe(res);
      } catch {
        res
          .status(404)
          .json({ error: 'FILE_NOT_FOUND', message: 'Source not found' });
      }
      return;
    }

    const key = `videos/${id}/hls/${rest}`;

    try {
      const stream = await this.storageService.getFileStream(key);
      if (rest.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      } else if (rest.endsWith('.ts')) {
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
