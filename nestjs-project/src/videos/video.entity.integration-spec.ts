import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Video, VideoStatus, VideoVisibility } from './video.entity';
import { Channel } from '../channels/entities/channel.entity';
import { User } from '../users/entities/user.entity';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from '../config/database.config';
import appConfig from '../config/app.config';
import { ulid } from 'ulid';

describe('VideoEntity', () => {
  let repository: Repository<Video>;
  let dataSource: DataSource;
  let channelRepository: Repository<Channel>;
  let userRepository: Repository<User>;
  let testChannelId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [databaseConfig, appConfig],
          isGlobal: true,
          envFilePath: '.env',
        }),
        TypeOrmModule.forRootAsync({
          useFactory: () => ({
            type: 'postgres' as const,
            host: process.env.DB_HOST || 'db',
            port: parseInt(process.env.DB_PORT || '5432', 10),
            username: process.env.DB_USERNAME || 'streamtube',
            password: process.env.DB_PASSWORD || 'streamtube',
            database: process.env.DB_NAME || 'streamtube',
            entities: [Video, Channel, User],
            synchronize: false,
            logging: false,
          }),
        }),
        TypeOrmModule.forFeature([Video, Channel, User]),
      ],
    }).compile();

    repository = module.get<Repository<Video>>(getRepositoryToken(Video));
    channelRepository = module.get<Repository<Channel>>(
      getRepositoryToken(Channel),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    dataSource = module.get<DataSource>(DataSource);

    const user = await userRepository.save({
      email: `video-test-${ulid()}@example.com`,
      password: 'hashed-password',
      name: 'Video Test User',
    });

    const channel = await channelRepository.save({
      name: 'Video Test Channel',
      nickname: `video-test-${ulid().toLowerCase().substring(0, 20)}`,
      user_id: user.id,
    });
    testChannelId = channel.id;
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM videos');
    await dataSource.query('DELETE FROM refresh_tokens');
    await dataSource.query('DELETE FROM verification_tokens');
    await dataSource.query('DELETE FROM channels');
    await dataSource.query('DELETE FROM users');
    await dataSource.destroy();
  });

  it('should create a video with draft status', async () => {
    const video = repository.create({
      channelId: testChannelId,
    });
    const saved = await repository.save(video);

    expect(saved.id).toBeDefined();
    expect(saved.id.length).toBe(26);
    expect(saved.status).toBe(VideoStatus.DRAFT);
    expect(saved.visibility).toBe(VideoVisibility.PUBLIC);
    expect(saved.viewCount).toBe(0);
    expect(saved.createdAt).toBeDefined();
    expect(saved.updatedAt).toBeDefined();
  });

  it('should have default values for nullable fields', async () => {
    const video = repository.create({
      channelId: testChannelId,
    });
    const saved = await repository.save(video);

    expect(saved.title).toBeNull();
    expect(saved.description).toBeNull();
    expect(saved.duration).toBeNull();
    expect(saved.thumbnailUrl).toBeNull();
    expect(saved.storagePath).toBeNull();
    expect(saved.hlsPlaylistUrl).toBeNull();
  });

  it('should update video status to ready', async () => {
    const video = repository.create({
      channelId: testChannelId,
    });
    let saved = await repository.save(video);

    saved.status = VideoStatus.READY;
    saved.title = 'My Test Video';
    saved.duration = 120;
    saved = await repository.save(saved);

    expect(saved.status).toBe(VideoStatus.READY);
    expect(saved.title).toBe('My Test Video');
    expect(saved.duration).toBe(120);
  });

  it('should enforce ULID sortability', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const video = repository.create({ channelId: testChannelId });
      const saved = await repository.save(video);
      ids.push(saved.id);
      await new Promise((r) => setTimeout(r, 5));
    }

    for (let i = 1; i < ids.length; i++) {
      expect(ids[i].localeCompare(ids[i - 1])).toBeGreaterThan(0);
    }
  });
});
