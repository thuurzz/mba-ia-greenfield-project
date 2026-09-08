import { Controller, Post, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';

@Controller()
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Post('channels/:channelId/subscribe')
  async subscribe(@Param('channelId') channelId: string, @CurrentUser() user: JwtPayload) {
    return this.subscriptionsService.subscribe(channelId, user.sub);
  }

  @Post('channels/:channelId/unsubscribe')
  async unsubscribe(@Param('channelId') channelId: string, @CurrentUser() user: JwtPayload) {
    return this.subscriptionsService.unsubscribe(channelId, user.sub);
  }

  @Public()
  @Get('channels/:channelId/subscribed')
  async isSubscribed(@Param('channelId') channelId: string, @CurrentUser() user?: JwtPayload) {
    return this.subscriptionsService.isSubscribed(channelId, user?.sub);
  }

  @Get('subscriptions')
  async findBySubscriber(
    @CurrentUser() user: JwtPayload,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedCursor = cursor ? JSON.parse(cursor) : undefined;
    return this.subscriptionsService.findBySubscriber(user.sub, parsedCursor, parseInt(limit || '20', 10));
  }
}