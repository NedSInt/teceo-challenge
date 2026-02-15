import { api } from '../../../config/config';
import type { PageDTO } from '../../../interfaces/page.interface';
import type { ProductColorDTO } from '../interfaces/product-color.dto';
import { PRODUCT_COLORS_PAGE_SIZE } from '../home.constants';

const homeRepository = () => {
  const getProductColors = (page: number, search?: string) => {
    const params: Record<string, string | number> = {
      limit: PRODUCT_COLORS_PAGE_SIZE,
      skip: page * PRODUCT_COLORS_PAGE_SIZE,
    };
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
