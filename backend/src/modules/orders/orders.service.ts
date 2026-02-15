import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ListOrdersResult } from './dtos/list-orders-response.dto';
import ListOrdersFilter from './dtos/list-orders.filter';
import Order from './orders.model';
import OrdersRepository from './orders.repository';
import { DEFAULT_ORDER_LIMIT } from './orders.constants';

@Injectable()
export default class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly repository: Repository<Order>,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  async list(filter: ListOrdersFilter): Promise<ListOrdersResult> {
    const limit = filter.limit ?? DEFAULT_ORDER_LIMIT;
    const skip = filter.skip ?? 0;
    const cursor = filter.cursor;
    const search = filter.customerNameOrEmail?.trim() || '';
    const searchParam = search ? `%${search}%` : null;

    const isFirstPage = !cursor && skip === 0;
    const includeCount = isFirstPage;

    if (cursor) {
      const data = await this.ordersRepository.fetchOrdersWithTotals({
        cursor,
        limit,
        searchParam,
        offset: null,
      });
      return { data };
    }

    const dataPromise = this.ordersRepository.fetchOrdersWithTotals({
      cursor: null,
      limit,
      searchParam,
      offset: skip,
    });

    const countPromise = includeCount
      ? this.ordersRepository.countOrders(searchParam)
      : Promise.resolve(0);

    const [data, count] = await Promise.all([dataPromise, countPromise]);

    return includeCount ? { data, count } : { data };
  }

  async update(orderId: string, order: Partial<Order>) {
    await this.repository.update(orderId, order);
  }

  async batchUpdate(orderIds: string[], order: Partial<Order>): Promise<void> {
    if (orderIds.length === 0) return;
    await this.repository.update({ id: In(orderIds) }, order);
  }
}
