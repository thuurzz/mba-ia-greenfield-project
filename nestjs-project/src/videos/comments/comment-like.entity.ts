import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, CreateDateColumn } from 'typeorm';
import { Comment } from './comment.entity';
import { User } from '../../users/entities/user.entity';

@Entity('comment_likes')
@Unique(['commentId', 'userId'])
export class CommentLike {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'comment_id', type: 'integer' })
  commentId: number;

  @ManyToOne(() => Comment)
  @JoinColumn({ name: 'comment_id' })
  comment: Comment;

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