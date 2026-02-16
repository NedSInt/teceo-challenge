import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import Page from '../../../commons/dtos/page.dto';
import { ListProductColorsDTO } from './dtos/list-product-colors.dto';
import ListProductColorsFilter from './dtos/list-product-colors.filter';
import ProductColor from './product-colors.model';
import ProductColorsRepository from './product-colors.repository';
import {
  CACHE_KEY_PREFIX,
  CACHE_TTL_MS,
  COUNT_CACHE_TTL_MS,
  DEFAULT_PRODUCT_COLORS_LIMIT,
} from './product-colors.constants';

@Injectable()
export default class ProductColorsService {
  constructor(
    @InjectRepository(ProductColor)
    private readonly repository: Repository<ProductColor>,
    private readonly productColorsRepository: ProductColorsRepository,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  async list(filter: ListProductColorsFilter): Promise<Page<ListProductColorsDTO>> {
    const cacheKey = this.buildCacheKey(filter);
    try {
      const cached = await this.cache.get<Page<ListProductColorsDTO>>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch {
    }

    const result = await this.fetchFromDatabase(filter);
    this.cache.set(cacheKey, result, CACHE_TTL_MS).catch(() => {});
    return result;
  }

  private buildCacheKey(filter: ListProductColorsFilter): string {
    const skip = filter.skip ?? 0;
    const limit = filter.limit ?? DEFAULT_PRODUCT_COLORS_LIMIT;
    const search = filter.productCodeOrName ?? '';
    const cursor = filter.cursor ?? '';
    return `${CACHE_KEY_PREFIX}:${limit}:${skip}:${cursor}:${search}`;
  }

  private buildCountCacheKey(filter: ListProductColorsFilter): string {
    const search = filter.productCodeOrName ?? '';
    return `${CACHE_KEY_PREFIX}:count:${search}`;
  }

  private async getCountCached(filter: ListProductColorsFilter): Promise<number> {
    const countKey = this.buildCountCacheKey(filter);
    try {
      const cached = await this.cache.get<number>(countKey);
      if (cached != null) {
        return cached;
      }
    } catch {
    }

    if (!filter.productCodeOrName) {
      const total =
        await this.productColorsRepository.getCountFromStats();
      this.cache.set(countKey, total, COUNT_CACHE_TTL_MS).catch(() => {});
      return total;
    }

    const total =
      await this.productColorsRepository.getCountWithFilter(filter);
    this.cache.set(countKey, total, CACHE_TTL_MS).catch(() => {});
    return total;
  }

  private async fetchFromDatabase(
    filter: ListProductColorsFilter,
  ): Promise<Page<ListProductColorsDTO>> {
    const skip = filter.skip ?? 0;
    const limit = filter.limit ?? DEFAULT_PRODUCT_COLORS_LIMIT;
    const cursor = filter.cursor;

    const [productColors, total] = await Promise.all([
      this.productColorsRepository.fetchDataOptimized({
        search: filter.productCodeOrName,
        skip,
        limit,
        cursor,
      }),
      this.getCountCached(filter),
    ]);

    if (productColors.length === 0) {
      return Page.of([], total);
    }

    const ids = productColors.map((pc) => pc.id);
    const priceMap =
      await this.productColorsRepository.getMinPricesByProductColorIds(ids);

    const data: ListProductColorsDTO[] = productColors.map((pc) => {
      const price = priceMap.get(pc.id) ?? 0;
      const { skus: _, ...rest } = pc;
      return { ...rest, price } as ListProductColorsDTO;
    });

    return Page.of(data, total);
  }
}
