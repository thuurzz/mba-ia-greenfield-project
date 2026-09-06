import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Subscription } from './subscription.entity';
import { Channel } from '../channels/entities/channel.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Channel)
    private channelRepository: Repository<Channel>,
  ) {}

  async subscribe(channelId: string, subscriberId: string) {
    const existing = await this.subscriptionRepository.findOne({ where: { channelId, subscriberId } });
    if (existing) throw new ConflictException('ALREADY_SUBSCRIBED');
    await this.subscriptionRepository.insert({ channelId, subscriberId });
    await this.channelRepository.increment({ id: channelId }, 'subscriberCount', 1);
    return { subscribed: true };
  }

  async unsubscribe(channelId: string, subscriberId: string) {
    const existing = await this.subscriptionRepository.findOne({ where: { channelId, subscriberId } });
    if (!existing) throw new NotFoundException('NOT_SUBSCRIBED');
    await this.subscriptionRepository.delete(existing.id);
    await this.channelRepository.decrement({ id: channelId }, 'subscriberCount', 1);
    return { subscribed: false };
  }

  async isSubscribed(channelId: string, subscriberId?: string) {
    if (!subscriberId) return { isSubscribed: false };
    const existing = await this.subscriptionRepository.findOne({ where: { channelId, subscriberId } });
    return { isSubscribed: !!existing };
  }

  async findBySubscriber(subscriberId: string, cursor?: { createdAt: string }, limit = 20) {
    const where: any = { subscriberId };
    if (cursor) {
      where.createdAt = LessThan(new Date(cursor.createdAt));
    }
    const subs = await this.subscriptionRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit + 1,
      relations: ['channel'],
    });
    const hasMore = subs.length > limit;
    return {
      subscriptions: subs.slice(0, limit),
      nextCursor: hasMore ? { createdAt: subs[limit - 1].createdAt.toISOString() } : null,
    };
  }
}