import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { Repository, SelectQueryBuilder } from 'typeorm';
import Page from '../../../commons/dtos/page.dto';
import { ListProductColorsDTO } from './dtos/list-product-colors.dto';
import ListProductColorsFilter from './dtos/list-product-colors.filter';
import ProductColor from './product-colors.model';
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
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  createQueryBuilder(): SelectQueryBuilder<ProductColor> {
    return this.repository.createQueryBuilder('productColor');
  }

  async list(filter: ListProductColorsFilter): Promise<Page<ListProductColorsDTO>> {
    const cacheKey = this.buildCacheKey(filter);
    const cached = await this.cache.get<Page<ListProductColorsDTO>>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.fetchFromDatabase(filter);
    this.cache.set(cacheKey, result, CACHE_TTL_MS).catch(() => {});
    return result;
  }

  private buildCacheKey(filter: ListProductColorsFilter): string {
    const skip = filter.skip ?? 0;
    const limit = filter.limit ?? DEFAULT_PRODUCT_COLORS_LIMIT;
    const search = filter.productCodeOrName ?? '';
    return `${CACHE_KEY_PREFIX}:${limit}:${skip}:${search}`;
  }

  private buildCountCacheKey(filter: ListProductColorsFilter): string {
    const search = filter.productCodeOrName ?? '';
    return `${CACHE_KEY_PREFIX}:count:${search}`;
  }

  private async getCountCached(filter: ListProductColorsFilter): Promise<number> {
    const countKey = this.buildCountCacheKey(filter);
    const cached = await this.cache.get<number>(countKey);
    if (cached != null) {
      return cached;
    }

    if (!filter.productCodeOrName) {
      const total = await this.getCountFromStats();
      await this.cache.set(countKey, total, COUNT_CACHE_TTL_MS);
      return total;
    }

    const countQueryBuilder = this.createQueryBuilder().leftJoin(
      'productColor.product',
      'product',
    );
    filter.createWhere(countQueryBuilder);
    const total = await countQueryBuilder.getCount();
    await this.cache.set(countKey, total, CACHE_TTL_MS);
    return total;
  }

  private async getCountFromStats(): Promise<number> {
    const rows = await this.repository.manager.query(
      `SELECT COALESCE(reltuples::bigint, 0) AS reltuples
       FROM pg_class WHERE relname = 'product_colors'`,
    );
    const val = (rows[0] as { reltuples?: string } | undefined)?.reltuples ?? '0';
    return Math.max(0, parseInt(val, 10));
  }

  private async fetchFromDatabase(
    filter: ListProductColorsFilter,
  ): Promise<Page<ListProductColorsDTO>> {
    const skip = filter.skip ?? 0;
    const limit = filter.limit ?? DEFAULT_PRODUCT_COLORS_LIMIT;

    const [productColors, total] = await Promise.all([
      this.fetchDataOptimized(filter, skip, limit),
      this.getCountCached(filter),
    ]);

    if (productColors.length === 0) {
      return Page.of([], total);
    }

    const ids = productColors.map((pc) => pc.id);
    const priceMap = await this.getMinPricesByProductColorIds(ids);

    const data: ListProductColorsDTO[] = productColors.map((pc) => {
      const price = priceMap.get(pc.id) ?? 0;
      const { skus: _, ...rest } = pc;
      return { ...rest, price } as ListProductColorsDTO;
    });

    return Page.of(data, total);
  }

  private async fetchDataOptimized(
    filter: ListProductColorsFilter,
    skip: number,
    limit: number,
  ): Promise<ProductColor[]> {
    const productsNeeded = Math.min(
      5000,
      Math.max(100, Math.ceil((skip + limit) * 2)),
    ) | 0;
    const search = filter.productCodeOrName;

    const whereClause = search
      ? 'WHERE (p.code ILIKE $1 OR p.name ILIKE $1)'
      : '';
    const params: (string | number)[] = search ? [`%${search}%`] : [];

    const cte = `WITH p_ordered AS MATERIALIZED (
      SELECT id, name FROM products p ${whereClause}
      ORDER BY p.name ASC, p.id ASC
      LIMIT ${productsNeeded}
    )`;

    const baseQuery = `
      ${cte}
      SELECT pc.id, pc.product_id, pc.color_id, pc.created_at, pc.updated_at
      FROM product_colors pc
      INNER JOIN p_ordered ON p_ordered.id = pc.product_id
      ORDER BY p_ordered.name ASC, pc.id ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, skip);

    const rows = await this.repository.manager.query(baseQuery, params);
    if (rows.length === 0) return [];

    const ids: string[] = rows.map((r: { id: string }) => r.id);
    const fullEntities = await this.createQueryBuilder()
      .leftJoinAndSelect('productColor.product', 'product')
      .leftJoinAndSelect('productColor.color', 'color')
      .andWhere('productColor.id IN (:...ids)', { ids })
      .orderBy('product.name', 'ASC')
      .addOrderBy('productColor.id', 'ASC')
      .getMany();

    const orderMap = new Map(ids.map((id: string, i: number) => [id, i]));
    fullEntities.sort(
      (a, b) =>
        (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );
    return fullEntities;
  }

  private async getMinPricesByProductColorIds(
    ids: string[],
  ): Promise<Map<string, number>> {
    const result = await this.repository.manager
      .createQueryBuilder()
      .select('sku.product_color_id', 'productColorId')
      .addSelect('MIN(sku.price)', 'minPrice')
      .from('skus', 'sku')
      .where('sku.product_color_id IN (:...ids)', { ids })
      .groupBy('sku.product_color_id')
      .getRawMany<{ productColorId: string; minPrice: string }>();

    return new Map(
      result.map((r) => [r.productColorId, Number(r.minPrice ?? 0)]),
    );
  }
}
