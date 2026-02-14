import { api } from '../../../config/config';
import type { PageDTO } from '../../../interfaces/page.interface';
import type { ProductColorDTO } from '../interfaces/product-color.dto';

const homeRepository = () => {
  const getProductColors = (page: number, search?: string) => {
    const limit = 10;
    const params: Record<string, string | number> = {
      limit,
      skip: page * limit,
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
