import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import OrderItem from './order-items.model';

export interface OrderTotalsRow {
  orderId: string;
  totalValue: number;
  totalQuantity: number;
  totalProductColors: number;
}

@Injectable()
export default class OrderItemsService {
  constructor(
    @InjectRepository(OrderItem)
    private readonly repository: Repository<OrderItem>,
  ) {}

  createQueryBuilder(alias: string): SelectQueryBuilder<OrderItem> {
    return this.repository.createQueryBuilder(alias);
  }

  async getTotalsByOrderIds(orderIds: string[]): Promise<OrderTotalsRow[]> {
    if (orderIds.length === 0) return [];

    const rows = await this.repository.manager.query<OrderTotalsRow[]>(
      `
      SELECT
        oi.order_id AS "orderId",
        COALESCE(SUM(oi.quantity * s.price), 0)::float AS "totalValue",
        COALESCE(SUM(oi.quantity), 0)::float AS "totalQuantity",
        COUNT(DISTINCT s.product_color_id)::int AS "totalProductColors"
      FROM order_items oi
      INNER JOIN skus s ON s.id = oi.sku_id
      WHERE oi.order_id = ANY($1)
      GROUP BY oi.order_id
      `,
      [orderIds],
    );

    return rows;
  }
}
