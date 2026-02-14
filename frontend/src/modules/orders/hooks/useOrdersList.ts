import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApplicationContext } from '../../global/contexts/ApplicationContext';
import type { PageDTO } from '../../../interfaces/page.interface';
import type { OrderStatus } from '../enums/orderStatus.enum';
import type { OrderDTO } from '../interfaces/order.dto';
import ordersRepository from '../repositories/orders.repository';

const useOrdersList = () => {
  const queryClient = useQueryClient();

  const { search, handleLoadingStatus } = useApplicationContext();
  const queryKey = ['orders', search];

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const infiniteQuery = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      return handleLoadingStatus<PageDTO<OrderDTO>>({
        disabled: !search?.length,
        requestFn: async () => {
          const response = await ordersRepository().getOrders(
            pageParam,
            search
          );
          return response.data;
        },
      });
    },
    getNextPageParam: (lastPage, pages) => {
      const totalLoaded = pages.reduce((sum, p) => sum + p.data.length, 0);
      if (totalLoaded >= lastPage.count || !lastPage.data.length) {
        return undefined;
      }
      return pages.length;
    },
    initialPageParam: 0,
  });

  const onChangeStatus = async (newStatus: OrderStatus, orderId: string) => {
    const isMassAction = selectedOrderIds.includes(orderId);

    const orderIds = isMassAction ? selectedOrderIds : [orderId];

    queryClient.setQueryData<{ pages: PageDTO<OrderDTO>[] }>(queryKey, oldData => {
      if (!oldData) {
        return oldData;
      }

      return {
        ...oldData,
        pages: oldData?.pages?.map(page => ({
          ...page,
          data: page.data.map(order =>
            orderIds.includes(order.id)
              ? { ...order, status: newStatus }
              : order
          ),
        })),
      };
    });

    try {
      if (isMassAction) {
        await ordersRepository().updateBatchOrderStatus(
          selectedOrderIds,
          newStatus
        );
      } else {
        await ordersRepository().updateOrderStatus(orderId, newStatus);
      }
    } catch (err) {
      queryClient.invalidateQueries({ queryKey });
    }

    setSelectedOrderIds([]);
  };

  const toggleOrderId = (orderId: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  return { ...infiniteQuery, onChangeStatus, toggleOrderId, selectedOrderIds };
};

export default useOrdersList;
