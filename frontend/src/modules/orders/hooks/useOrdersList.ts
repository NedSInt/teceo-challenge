import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { useApplicationContext } from '../../global/contexts/ApplicationContext';
import type { PageDTO } from '../../../interfaces/page.interface';
import type { OrderStatus } from '../enums/orderStatus.enum';
import type { OrderDTO } from '../interfaces/order.dto';
import ordersRepository from '../repositories/orders.repository';
import { ORDERS_PAGE_SIZE } from '../orders.constants';

const ORDERS_STALE_TIME_MS = 5 * 60 * 1000; // 5 minutos — menos refetches automáticos

const useOrdersList = () => {
  const queryClient = useQueryClient();
  const { search } = useApplicationContext();
  const queryKey = ['orders', search];

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const selectedOrderIdsRef = useRef<string[]>([]);
  selectedOrderIdsRef.current = selectedOrderIds;

  const infiniteQuery = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const response = await ordersRepository().getOrders(pageParam, search);
      return response.data;
    },
    getNextPageParam: (lastPage, pages) => {
      if (!lastPage.data.length) return undefined;
      const totalLoaded = pages.reduce((sum, p) => sum + p.data.length, 0);
      if (
        lastPage.count != null &&
        lastPage.count > 0 &&
        totalLoaded >= lastPage.count
      ) {
        return undefined;
      }
      if (lastPage.data.length < ORDERS_PAGE_SIZE) return undefined;
      return lastPage.data[lastPage.data.length - 1]?.id;
    },
    initialPageParam: undefined as string | undefined,
    staleTime: ORDERS_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const onChangeStatus = useCallback(
    async (newStatus: OrderStatus, orderId: string) => {
      const currentIds = selectedOrderIdsRef.current;
      const isMassAction = currentIds.includes(orderId);
      const orderIds = isMassAction ? currentIds : [orderId];

      queryClient.setQueryData<{ pages: PageDTO<OrderDTO>[] }>(
        queryKey,
        oldData => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map(page => ({
              ...page,
              data: page.data.map(order =>
                orderIds.includes(order.id)
                  ? { ...order, status: newStatus }
                  : order
              ),
            })),
          };
        }
      );

      try {
        if (isMassAction) {
          await ordersRepository().updateBatchOrderStatus(currentIds, newStatus);
        } else {
          await ordersRepository().updateOrderStatus(orderId, newStatus);
        }
      } catch {
        queryClient.invalidateQueries({ queryKey });
      }

      setSelectedOrderIds([]);
    },
    [queryClient, queryKey]
  );

  const toggleOrderId = useCallback((orderId: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  }, []);

  return { ...infiniteQuery, onChangeStatus, toggleOrderId, selectedOrderIds };
};

export default useOrdersList;
