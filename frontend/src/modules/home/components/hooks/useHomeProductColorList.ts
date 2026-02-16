import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useApplicationContext } from '../../../global/contexts/ApplicationContext';
import homeRepository from '../../repositories/home.repository';

const PRODUCT_COLORS_STALE_TIME_MS = 5 * 60 * 1000; // 5 minutos

const useHomeProductColorList = () => {
  const { search } = useApplicationContext();

  const infiniteQuery = useInfiniteQuery({
    queryKey: ['product-colors', search],
    queryFn: async ({ pageParam }) => {
      const response = await homeRepository().getProductColors(pageParam, search);
      return response.data;
    },
    getNextPageParam: (lastPage, pages) => {
      const totalLoaded = pages.reduce((sum, p) => sum + p.data.length, 0);
      if (
        (lastPage.count != null && totalLoaded >= lastPage.count) ||
        !lastPage.data.length
      ) {
        return undefined;
      }
      const lastItem = lastPage.data[lastPage.data.length - 1];
      return lastItem?.id;
    },
    initialPageParam: undefined as string | undefined,
    staleTime: PRODUCT_COLORS_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  return infiniteQuery;
};

export default useHomeProductColorList;
