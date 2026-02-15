import { IsOptional, IsString, IsUUID } from 'class-validator';
import { SelectQueryBuilder } from 'typeorm';
import BaseFilter from '../../../../commons/filters/base.filter';
import Order from '../orders.model';

export default class ListOrdersFilter extends BaseFilter<Order> {
  @IsOptional()
  @IsString()
  customerNameOrEmail?: string;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  createWhere(queryBuilder: SelectQueryBuilder<Order>): void {
    if (this.customerNameOrEmail) {
      queryBuilder.andWhere(
        '(customer.name ILIKE :customerNameOrEmail OR customer.email ILIKE :customerNameOrEmail)',
        { customerNameOrEmail: `%${this.customerNameOrEmail}%` },
      );
    }
  }
}
