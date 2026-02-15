import { ListOrdersDTO } from './list-orders.dto';

export interface ListOrdersResult {
  data: ListOrdersDTO[];
  count?: number;
}
