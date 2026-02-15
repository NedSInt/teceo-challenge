import { useInfiniteQuery } from '@tanstack/react-query';
import { useApplicationContext } from '../../../global/contexts/ApplicationContext';
import type { PageDTO } from '../../../../interfaces/page.interface';
import type { ProductColorDTO } from '../../interfaces/product-color.dto';
import homeRepository from '../../repositories/home.repository';

const useHomeProductColorList = () => {
  const { search, handleLoadingStatus } = useApplicationContext();

  const infiniteQuery = useInfiniteQuery({
    queryKey: ['product-colors', search],
    queryFn: async ({ pageParam }) => {
      return handleLoadingStatus<PageDTO<ProductColorDTO>>({
        disabled: !search?.length,
        requestFn: async () => {
          const response = await homeRepository().getProductColors(pageParam, search);
          return response.data;
        },
      });
    },
    getNextPageParam: (lastPage, pages) => {
      const totalLoaded = pages.reduce((sum, p) => sum + p.data.length, 0);
      if (
        (lastPage.count != null && totalLoaded >= lastPage.count) ||
        !lastPage.data.length
      ) {
        return undefined;
      }
      return pages.length;
    },
    initialPageParam: 0,
  });

  return infiniteQuery;
};

export default useHomeProductColorList;
