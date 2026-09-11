import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { VideoStatus } from '../videos/video.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video } from '../videos/video.entity';
import { StorageService } from '../videos/storage.service';

@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);

  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
    private storageService: StorageService,
  ) {}

  async processVideo(videoId: string): Promise<void> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
    });
    if (!video || !video.storagePath) {
      throw new Error(`Video ${videoId} not found or has no storage path`);
    }

    await this.videoRepository.update(videoId, {
      status: VideoStatus.PROCESSING,
    });

    const tempDir = `/tmp/video-processing/${videoId}`;
    const sourcePath = `${tempDir}/source.mp4`;
    const outputDir = `${tempDir}/hls`;

    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    try {
      const stream = await this.storageService.getFileStream(video.storagePath);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      await fs.writeFile(sourcePath, Buffer.concat(chunks));

      const metadata = await this.extractMetadata(sourcePath);
      const thumbnailPath = `${tempDir}/thumbnail.jpg`;
      await this.generateThumbnail(sourcePath, thumbnailPath);

      const variants = [
        { name: '360p', scale: '-2:360', bitrate: '600k', abr: '48k' },
      ];

      for (const variant of variants) {
        await this.transcodeToHls(
          sourcePath,
          `${outputDir}/${variant.name}`,
          variant,
        );
      }

      await this.createMasterPlaylist(outputDir, variants);

      const hlsBaseKey = `videos/${videoId}/hls`;
      await this.uploadDirectory(outputDir, hlsBaseKey);

      const thumbnailKey = `thumbnails/${videoId}.jpg`;
      const thumbnailData = await fs.readFile(thumbnailPath);
      await this.storageService.uploadFile(
        thumbnailKey,
        thumbnailData,
        'image/jpeg',
      );

      await this.videoRepository.update(videoId, {
        status: VideoStatus.READY,
        duration: metadata.duration,
        thumbnailUrl: thumbnailKey,
        hlsPlaylistUrl: `${hlsBaseKey}/master.m3u8`,
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  private extractMetadata(inputPath: string): Promise<{ duration: number }> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffprobe', [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        inputPath,
      ]);

      let output = '';
      proc.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });
      proc.on('close', (code) => {
        if (code !== 0)
          return reject(new Error(`ffprobe exited with code ${code}`));
        try {
          const info = JSON.parse(output) as { format?: { duration?: string } };
          resolve({
            duration: Math.round(parseFloat(info.format?.duration || '0')),
          });
        } catch {
          reject(new Error('Failed to parse ffprobe output'));
        }
      });
      proc.on('error', reject);
    });
  }

  private async generateThumbnail(
    inputPath: string,
    outputPath: string,
  ): Promise<void> {
    // Try scene-detection first (nicer frame); fall back to a fixed mid-video frame.
    // ffmpeg exits 0 even when no frames were encoded — verify the output file exists.
    try {
      await this.runFfmpeg([
        '-i',
        inputPath,
        '-vf',
        "select='gt(scene,0.4)',setpts=N/(2*TB)",
        '-frames:v',
        '1',
        '-q:v',
        '3',
        outputPath,
      ]);
      if (await this.fileExists(outputPath)) return;
    } catch {
      // fall through to fallback
    }

    await this.runFfmpeg([
      '-i',
      inputPath,
      '-ss',
      '1',
      '-frames:v',
      '1',
      '-q:v',
      '3',
      outputPath,
    ]);
    if (!(await this.fileExists(outputPath))) {
      throw new Error('Thumbnail generation produced no output');
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args);
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });
      proc.on('error', reject);
    });
  }

  private transcodeToHls(
    inputPath: string,
    outputDir: string,
    variant: { name: string; scale: string; bitrate: string; abr: string },
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      await fs.mkdir(outputDir, { recursive: true });
      const proc = spawn('ffmpeg', [
        '-i',
        inputPath,
        '-vf',
        `scale=${variant.scale}`,
        '-c:v',
        'libx264',
        '-b:v',
        variant.bitrate,
        '-c:a',
        'aac',
        '-b:a',
        variant.abr,
        '-hls_time',
        '6',
        '-hls_playlist_type',
        'vod',
        '-hls_segment_filename',
        `${outputDir}/seg-%d.ts`,
        `${outputDir}/playlist.m3u8`,
      ]);
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `HLS transcoding ${variant.name} failed with code ${code}`,
            ),
          );
        }
      });
      proc.on('error', reject);
    });
  }

  private async createMasterPlaylist(
    outputDir: string,
    variants: { name: string; bitrate: string; abr: string }[],
  ) {
    let content = '#EXTM3U\n';
    for (const v of variants) {
      const bitrateKbps = parseInt(v.bitrate) + parseInt(v.abr);
      content += `#EXT-X-STREAM-INF:BANDWIDTH=${bitrateKbps * 1000},RESOLUTION=${v.name === '360p' ? '640x360' : v.name === '480p' ? '854x480' : v.name === '720p' ? '1280x720' : '1920x1080'}\n`;
      content += `${v.name}/playlist.m3u8\n`;
    }
    await fs.writeFile(`${outputDir}/master.m3u8`, content);
  }

  private async uploadDirectory(localDir: string, remotePrefix: string) {
    const entries = await fs.readdir(localDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(localDir, entry);
      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        const data = await fs.readFile(fullPath);
        const mimeType = entry.endsWith('.ts')
          ? 'video/MP2T'
          : entry.endsWith('.m3u8')
            ? 'application/vnd.apple.mpegurl'
            : 'application/octet-stream';
        await this.storageService.uploadFile(
          `${remotePrefix}/${entry}`,
          data,
          mimeType,
        );
      }
    }
  }
}
