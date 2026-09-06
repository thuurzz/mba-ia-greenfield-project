import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import { ulid } from 'ulid';
import { ulidTransformer } from './ulid-transformer';

export enum VideoStatus {
  DRAFT = 'draft',
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

export enum VideoVisibility {
  PUBLIC = 'public',
  UNLISTED = 'unlisted',
}

@Entity('videos')
export class Video {
  @PrimaryColumn({ type: 'varchar', length: 26, transformer: ulidTransformer })
  id: string = ulid();

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: VideoStatus,
    default: VideoStatus.DRAFT,
  })
  status: VideoStatus;

  @Column({
    type: 'enum',
    enum: VideoVisibility,
    default: VideoVisibility.PUBLIC,
  })
  visibility: VideoVisibility;

  @Column({ name: 'channel_id' })
  channelId: string;

  @ManyToOne(() => Channel)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @Column({ name: 'category_id', type: 'integer', nullable: true })
  categoryId: number | null;

  @Column({ type: 'integer', nullable: true })
  duration: number | null;

  @Column({
    name: 'thumbnail_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  thumbnailUrl: string | null;

  @Column({
    name: 'storage_path',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  storagePath: string | null;

  @Column({
    name: 'hls_playlist_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  hlsPlaylistUrl: string | null;

  @Column({
    name: 'original_file_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  originalFileName: string | null;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize: number | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ name: 'view_count', type: 'integer', default: 0 })
  viewCount: number;

  @Column({ name: 'likes_count', type: 'integer', default: 0 })
  likesCount: number;

  @Column({ name: 'dislikes_count', type: 'integer', default: 0 })
  dislikesCount: number;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
