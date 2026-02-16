import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { SelectQueryBuilder } from 'typeorm';
import BaseFilter from '../../../../commons/filters/base.filter';
import ProductColor from '../product-colors.model';

export default class ListProductColorsFilter extends BaseFilter<ProductColor> {
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' && (value.includes('?') || value.includes('='))
      ? undefined
      : value,
  )
  productCodeOrName?: string;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  createWhere(queryBuilder: SelectQueryBuilder<ProductColor>): void {
    if (this.productCodeOrName) {
      queryBuilder.andWhere(
        `product.id IN (
          SELECT p2.id FROM products p2 WHERE p2.code ILIKE (:productCodeOrName) OR p2.name ILIKE (:productCodeOrName)
        )`,
        { productCodeOrName: `%${this.productCodeOrName}%` },
      );
    }
  }
}
