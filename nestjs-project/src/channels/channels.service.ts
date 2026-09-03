import { Injectable, ConflictException } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { appendRandomSuffix, sanitizeNickname } from './nickname.util';
import { Channel } from './entities/channel.entity';

const PG_UNIQUE_VIOLATION = '23505';
const NICKNAME_COLUMN = 'nickname';
const MAX_RETRIES = 5;

function isPgUniqueViolationOnColumn(err: unknown, column: string): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const e = err as any;
  return (
    e.code === PG_UNIQUE_VIOLATION &&
    typeof e.detail === 'string' &&
    e.detail.includes(column)
  );
}

@Injectable()
export class ChannelsService {
  constructor(private readonly dataSource: DataSource) {}

  async createChannel(userId: string, email: string): Promise<Channel> {
    const baseNickname = sanitizeNickname(email.split('@')[0]);

    return this.dataSource.transaction(async (manager) => {
      let nickname = baseNickname;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const existing = await manager.findOne(Channel, {
          where: { nickname },
        });
        if (existing) {
          nickname = appendRandomSuffix(baseNickname);
          continue;
        }

        try {
          return await manager.save(
            manager.create(Channel, {
              name: baseNickname,
              nickname,
              user_id: userId,
            }),
          );
        } catch (err) {
          if (isPgUniqueViolationOnColumn(err, NICKNAME_COLUMN)) {
            // Concurrent insert between pre-check and save — retry with new suffix
            nickname = appendRandomSuffix(baseNickname);
          } else {
            throw err;
          }
        }
      }

      throw new Error(
        'Nickname conflict could not be resolved after max retries',
      );
    });
  }

  async findByUserId(userId: string): Promise<Channel | null> {
    return this.dataSource.manager.findOne(Channel, {
      where: { user_id: userId },
    });
  }

  async findByNickname(nickname: string): Promise<Channel | null> {
    return this.dataSource.manager.findOne(Channel, {
      where: { nickname },
    });
  }

  async updateChannel(id: string, dto: Partial<Channel>): Promise<Channel> {
    if (dto.nickname) {
      const existing = await this.dataSource.manager.findOne(Channel, {
        where: { nickname: dto.nickname },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('NICKNAME_ALREADY_TAKEN');
      }
    }
    await this.dataSource.manager.update(Channel, id, dto);
    return this.dataSource.manager.findOne(Channel, { where: { id } }) as Promise<Channel>;
  }
}
