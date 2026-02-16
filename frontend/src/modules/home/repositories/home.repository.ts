import { api } from '../../../config/config';
import type { PageDTO } from '../../../interfaces/page.interface';
import type { ProductColorDTO } from '../interfaces/product-color.dto';
import { PRODUCT_COLORS_PAGE_SIZE } from '../home.constants';

const homeRepository = () => {
  const getProductColors = (
    cursorOrPage: string | number | undefined,
    search?: string,
  ) => {
    const params: Record<string, string | number | undefined> = {
      limit: PRODUCT_COLORS_PAGE_SIZE,
    };
    if (typeof cursorOrPage === 'string') {
      params.cursor = cursorOrPage;
    } else {
      const page = typeof cursorOrPage === 'number' ? cursorOrPage : 0;
      params.skip = page * PRODUCT_COLORS_PAGE_SIZE;
    }
    if (search != null && search.trim() !== '') {
      params.productCodeOrName = search.trim();
    }
    return api.get<PageDTO<ProductColorDTO>>('/product-colors', { params });
  };

  return {
    getProductColors,
  };
};

export default homeRepository;
