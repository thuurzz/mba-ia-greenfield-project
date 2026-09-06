import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, CreateDateColumn } from 'typeorm';
import { Video } from './video.entity';
import { User } from '../users/entities/user.entity';

@Entity('video_likes')
@Unique(['videoId', 'userId'])
export class VideoLike {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'video_id', type: 'varchar', length: 26 })
  videoId: string;

  @ManyToOne(() => Video)
  @JoinColumn({ name: 'video_id' })
  video: Video;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'is_like', type: 'boolean' })
  isLike: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}