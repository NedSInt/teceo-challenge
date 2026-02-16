import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import ListProductColorsFilter from './dtos/list-product-colors.filter';
import ProductColor from './product-colors.model';

export interface FetchProductColorsOpts {
  search: string | undefined;
  skip: number;
  limit: number;
  cursor?: string;
}

@Injectable()
export default class ProductColorsRepository {
  constructor(
    @InjectRepository(ProductColor)
    private readonly repository: Repository<ProductColor>,
  ) {}

  async fetchDataOptimized(
    opts: FetchProductColorsOpts,
  ): Promise<ProductColor[]> {
    const { search, skip, limit, cursor } = opts;

    if (cursor) {
      return this.fetchWithCursor({ search, limit, cursor });
    }

    const productsNeeded = Math.min(
      5000,
      Math.max(100, Math.ceil((skip + limit) * 2)),
    ) | 0;

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
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );
    return fullEntities;
  }

  private async fetchWithCursor(opts: {
    search: string | undefined;
    limit: number;
    cursor: string;
  }): Promise<ProductColor[]> {
    const { search, limit, cursor } = opts;
    const params: (string | number)[] = search ? [`%${search}%`] : [];
    params.push(cursor, limit);
    const cursorParam = params.length - 1;
    const limitParam = params.length;
    const whereClause = search
      ? `AND (p.code ILIKE $1 OR p.name ILIKE $1)`
      : '';

    const baseQuery = `
      SELECT pc.id, pc.product_id, pc.color_id, pc.created_at, pc.updated_at
      FROM product_colors pc
      INNER JOIN products p ON p.id = pc.product_id
      WHERE pc.id > $${cursorParam} ${whereClause}
      ORDER BY pc.id ASC
      LIMIT $${limitParam}
    `;

    const rows = await this.repository.manager.query(baseQuery, params);
    if (rows.length === 0) return [];

    const ids: string[] = rows.map((r: { id: string }) => r.id);
    const fullEntities = await this.createQueryBuilder()
      .leftJoinAndSelect('productColor.product', 'product')
      .leftJoinAndSelect('productColor.color', 'color')
      .andWhere('productColor.id IN (:...ids)', { ids })
      .orderBy('productColor.id', 'ASC')
      .getMany();

    const orderMap = new Map(ids.map((id: string, i: number) => [id, i]));
    fullEntities.sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );
    return fullEntities;
  }

  getCountWithFilter(filter: ListProductColorsFilter): Promise<number> {
    const queryBuilder = this.createQueryBuilder().leftJoin(
      'productColor.product',
      'product',
    );
    filter.createWhere(queryBuilder);
    return queryBuilder.getCount();
  }

  async getCountFromStats(): Promise<number> {
    const rows = await this.repository.manager.query(
      `SELECT COALESCE(reltuples::bigint, 0) AS reltuples
       FROM pg_class WHERE relname = 'product_colors'`,
    );
    const val = (rows[0] as { reltuples?: string } | undefined)?.reltuples ?? '0';
    return Math.max(0, parseInt(val, 10));
  }

  async getMinPricesByProductColorIds(
    ids: string[],
  ): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();

    const rows = await this.repository.manager.query<{
      productColorId: string;
      minPrice: string;
    }[]>(
      `SELECT sku.product_color_id AS "productColorId", MIN(sku.price)::float AS "minPrice"
       FROM skus sku
       WHERE sku.product_color_id = ANY($1)
       GROUP BY sku.product_color_id`,
      [ids],
    );

    return new Map(
      rows.map((r) => [r.productColorId, Number(r.minPrice ?? 0)]),
    );
  }

  private createQueryBuilder(): SelectQueryBuilder<ProductColor> {
    return this.repository.createQueryBuilder('productColor');
  }
}
