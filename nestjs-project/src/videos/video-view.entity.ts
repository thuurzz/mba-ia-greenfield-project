import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Video } from './video.entity';

@Entity('video_views')
@Index(['videoId', 'ip', 'viewedAt'])
export class VideoView {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'video_id', type: 'varchar', length: 26 })
  videoId: string;

  @ManyToOne(() => Video)
  @JoinColumn({ name: 'video_id' })
  video: Video;

  @Column({ type: 'varchar', length: 45 })
  ip: string;

  @Column({ name: 'viewed_at', type: 'timestamp', default: () => 'NOW()' })
  viewedAt: Date;
}