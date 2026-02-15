import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListOrdersDTO } from './dtos/list-orders.dto';
import Order from './orders.model';

export interface FetchOrdersOpts {
  cursor: string | null;
  limit: number;
  searchParam: string | null;
  offset: number | null;
}

interface RawOrderRow {
  id: string;
  status: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  totalValue: number;
  totalQuantity: number;
  totalProductColors: number;
}

@Injectable()
export default class OrdersRepository {
  constructor(
    @InjectRepository(Order)
    private readonly repository: Repository<Order>,
  ) {}

  async fetchOrdersWithTotals(opts: FetchOrdersOpts): Promise<ListOrdersDTO[]> {
    const { cursor, limit, searchParam, offset } = opts;
    const where = this.buildWhereClause(searchParam);

    const params: unknown[] = [...where.params];
    let paramIndex = params.length + 1;

    const cursorCondition = cursor ? `AND o.id > $${paramIndex++}` : '';
    if (cursor) params.push(cursor);

    const offsetClause = offset != null ? `OFFSET $${paramIndex++}` : '';
    if (offset != null) params.push(offset);

    params.push(limit);
    const limitParam = `$${paramIndex}`;

    const sql = `
      WITH paged AS (
        SELECT o.id
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE ${where.sql} ${cursorCondition}
        ORDER BY o.id ASC
        ${offsetClause}
        LIMIT ${limitParam}
      )
      SELECT
        o.id,
        o.status,
        o.customer_id AS "customerId",
        c.id AS "customer_id",
        c.name AS "customer_name",
        c.email AS "customer_email",
        COALESCE(agg."totalValue", 0)::float AS "totalValue",
        COALESCE(agg."totalQuantity", 0)::float AS "totalQuantity",
        COALESCE(agg."totalProductColors", 0)::int AS "totalProductColors"
      FROM orders o
      JOIN paged p ON p.id = o.id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN (
        SELECT
          oi.order_id,
          SUM(oi.quantity * s.price)::float AS "totalValue",
          SUM(oi.quantity)::float AS "totalQuantity",
          COUNT(DISTINCT s.product_color_id)::int AS "totalProductColors"
        FROM order_items oi
        INNER JOIN skus s ON s.id = oi.sku_id
        WHERE oi.order_id IN (SELECT id FROM paged)
        GROUP BY oi.order_id
      ) agg ON agg.order_id = o.id
      ORDER BY o.id ASC
    `;

    const rows = await this.repository.manager.query<RawOrderRow[]>(sql, params);
    return this.mapRowsToDto(rows);
  }

  async countOrders(searchParam: string | null): Promise<number> {
    const where = this.buildWhereClause(searchParam);

    const sql = `
      SELECT COUNT(*)::int AS cnt
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE ${where.sql}
    `;

    const result = await this.repository.manager.query<{ cnt: number }[]>(
      sql,
      where.params,
    );
    return result[0]?.cnt ?? 0;
  }

  private buildWhereClause(searchParam: string | null): { sql: string; params: unknown[] } {
    if (!searchParam) {
      return { sql: '1=1', params: [] };
    }
    return {
      sql: '(c.name ILIKE $1 OR c.email ILIKE $1)',
      params: [searchParam],
    };
  }

  private mapRowsToDto(rows: RawOrderRow[]): ListOrdersDTO[] {
    return rows.map((row) => {
      const totalValue = Number(row.totalValue ?? 0);
      const totalQuantity = Number(row.totalQuantity ?? 0);
      const totalProductColors = Number(row.totalProductColors ?? 0);
      const averageValuePerUnit =
        totalQuantity > 0
          ? parseFloat((totalValue / totalQuantity).toFixed(2))
          : 0;
      const averageValuePerProductColor =
        totalProductColors > 0
          ? parseFloat((totalValue / totalProductColors).toFixed(2))
          : 0;

      return {
        id: row.id,
        status: row.status,
        customer: {
          id: row.customer_id ?? '',
          name: row.customer_name ?? '',
          email: row.customer_email ?? '',
        } as ListOrdersDTO['customer'],
        totalValue,
        totalQuantity,
        totalProductColors,
        averageValuePerUnit,
        averageValuePerProductColor,
      };
    });
  }
}
