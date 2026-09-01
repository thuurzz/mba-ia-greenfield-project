import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { ConfigModule } from '@nestjs/config';
import storageConfig from '../config/storage.config';

describe('StorageService', () => {
  let service: StorageService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [storageConfig],
          isGlobal: true,
          envFilePath: '.env',
        }),
      ],
      providers: [StorageService],
    }).compile();

    await module.init();
    service = module.get<StorageService>(StorageService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should upload and download a file', async () => {
    const key = 'test-upload.txt';
    const content = 'Hello MinIO';
    await service.uploadFile(key, Buffer.from(content), 'text/plain');

    const exists = await service.fileExists(key);
    expect(exists).toBe(true);

    await service.deleteFile(key);

    const existsAfterDelete = await service.fileExists(key);
    expect(existsAfterDelete).toBe(false);
  });

  it('should return false for non-existent file', async () => {
    const exists = await service.fileExists('non-existent-file-xyz');
    expect(exists).toBe(false);
  });
});
