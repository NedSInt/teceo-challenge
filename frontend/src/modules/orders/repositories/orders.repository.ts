import { api } from '../../../config/config';
import type { PageDTO } from '../../../interfaces/page.interface';
import type { OrderStatus } from '../enums/orderStatus.enum';
import type { OrderDTO } from '../interfaces/order.dto';
import { ORDERS_PAGE_SIZE } from '../orders.constants';

const ordersRepository = () => {
  const getOrders = (
    cursorOrPage: string | number | undefined,
    search?: string
  ) => {
    const params: Record<string, string | number | undefined> = {
      limit: ORDERS_PAGE_SIZE,
      customerNameOrEmail: search || undefined,
    };

    if (typeof cursorOrPage === 'string') {
      params.cursor = cursorOrPage;
    } else if (typeof cursorOrPage === 'number') {
      params.skip = cursorOrPage * ORDERS_PAGE_SIZE;
    }

    return api.get<PageDTO<OrderDTO>>('/orders', { params });
  };

  const updateOrderStatus = async (
    orderId: string,
    orderStatus: OrderStatus
  ): Promise<void> => {
    await api.patch(`/orders/${orderId}`, { status: orderStatus });
  };

  const updateBatchOrderStatus = async (
    orderIds: string[],
    orderStatus: OrderStatus
  ) => {
    await api.patch(`/orders/`, { status: orderStatus, orderIds });
  };

  return {
    getOrders,
    updateOrderStatus,
    updateBatchOrderStatus,
  };
};

export default ordersRepository;
