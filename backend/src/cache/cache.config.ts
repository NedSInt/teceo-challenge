import { CacheModuleOptions } from '@nestjs/cache-manager';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';

export async function createCacheOptions(
  config: ConfigService,
): Promise<CacheModuleOptions> {
  const ttlSeconds = config.get<number>('REDIS_TTL_SECONDS', 300);
  const host = config.get<string>('REDIS_HOST', 'localhost');
  const port = config.get<number>('REDIS_PORT', 6379);
  const password = config.get<string>('REDIS_PASSWORD');

  try {
    const url = password
      ? `redis://:${password}@${host}:${port}`
      : `redis://${host}:${port}`;
    const keyv = createKeyv(url, {
      namespace: 'teceo-cache',
      connectionTimeout: 2000,
    });
    return { stores: [keyv], ttl: ttlSeconds * 1000 };
  } catch (err) {
    Logger.warn(
      'Redis indisponível, usando cache em memória. Configure REDIS_HOST se Redis estiver disponível.',
      'CacheModule',
    );
    return { ttl: ttlSeconds * 1000 };
  }
}
