import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, CreateDateColumn } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import { User } from '../users/entities/user.entity';

@Entity('subscriptions')
@Unique(['channelId', 'subscriberId'])
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'channel_id', type: 'uuid' })
  channelId: string;

  @ManyToOne(() => Channel)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @Column({ name: 'subscriber_id', type: 'uuid' })
  subscriberId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'subscriber_id' })
  subscriber: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}