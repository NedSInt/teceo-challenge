import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import Page from '../../../commons/dtos/page.dto';
import OrderItemsService from '../order-items/order-items.service';
import { ListOrdersDTO } from './dtos/list-orders.dto';
import ListOrdersFilter from './dtos/list-orders.filter';
import Order from './orders.model';

@Injectable()
export default class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly repository: Repository<Order>,

    private readonly orderItemsService: OrderItemsService,
  ) {}

  createQueryBuilder(alias: string): SelectQueryBuilder<Order> {
    return this.repository.createQueryBuilder(alias);
  }

  async list(filter: ListOrdersFilter): Promise<Page<ListOrdersDTO>> {
    const queryBuilder = this.createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .orderBy('order.id', 'ASC');

    filter.createWhere(queryBuilder);
    filter.paginate(queryBuilder);

    const [orders, count] = await queryBuilder.getManyAndCount();
    const ordersWithTotals = await this.getOrdersWithTotals(orders);

    return Page.of(ordersWithTotals, count);
  }

  private async getOrdersWithTotals(orders: Order[]): Promise<ListOrdersDTO[]> {
    if (orders.length === 0) return [];

    const orderIds = orders.map((o) => o.id);
    const orderItems = await this.orderItemsService
      .createQueryBuilder('orderItem')
      .leftJoinAndSelect('orderItem.sku', 'sku')
      .leftJoinAndSelect('sku.productColor', 'productColor')
      .leftJoinAndSelect('orderItem.order', 'order')
      .where('order.id IN (:...orderIds)', { orderIds })
      .getMany();

    const itemsByOrderId = new Map<string, typeof orderItems>();
    for (const item of orderItems) {
      const orderId = item.order.id;
      const list = itemsByOrderId.get(orderId) ?? [];
      list.push(item);
      itemsByOrderId.set(orderId, list);
    }

    return orders.map((order) => {
      const items = itemsByOrderId.get(order.id) ?? [];
      let totalValue = 0;
      let totalQuantity = 0;
      const productColorIds = new Set<string>();

      for (const item of items) {
        if (item.sku) {
          totalValue += Number(item.sku.price) * Number(item.quantity);
          productColorIds.add(item.sku.productColor.id);
        }
        totalQuantity += Number(item.quantity);
      }

      const totalProductColors = productColorIds.size;
      const averageValuePerUnit =
        totalQuantity ? parseFloat((totalValue / totalQuantity).toFixed(2)) : 0;
      const averageValuePerProductColor =
        totalProductColors
          ? parseFloat((totalValue / totalProductColors).toFixed(2))
          : 0;

      return {
        id: order.id,
        status: order.status,
        customer: order.customer,
        totalValue,
        totalQuantity,
        totalProductColors,
        averageValuePerUnit,
        averageValuePerProductColor,
      };
    });
  }

  async update(orderId: string, order: Partial<Order>) {
    await this.repository.update(orderId, order);
  }

  async batchUpdate(orderIds: string[], order: Partial<Order>): Promise<void> {
    if (orderIds.length === 0) return;
    await this.repository.update({ id: In(orderIds) }, order);
  }
}
