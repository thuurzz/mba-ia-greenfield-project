import { Controller, Get, Patch, Param, Body, NotFoundException } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';

@Controller('channels')
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @Get('me')
  async getMyChannel(@CurrentUser() user: JwtPayload) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    return channel;
  }

  @Patch('me')
  async updateMyChannel(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateChannelDto,
  ) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    return this.channelsService.updateChannel(channel.id, dto);
  }

  @Public()
  @Get(':nickname')
  async findByNickname(@Param('nickname') nickname: string) {
    const channel = await this.channelsService.findByNickname(nickname);
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    return channel;
  }
}