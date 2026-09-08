import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { Video } from '../video.entity';
import { User } from '../../users/entities/user.entity';

@Entity('comments')
export class Comment {
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

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'parent_id', type: 'integer', nullable: true })
  parentId: number | null;

  @Column({ name: 'likes_count', type: 'integer', default: 0 })
  likesCount: number;

  @Column({ name: 'dislikes_count', type: 'integer', default: 0 })
  dislikesCount: number;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;
}