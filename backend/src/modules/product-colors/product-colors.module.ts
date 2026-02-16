import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import ProductColorsController from './product-colors.controller';
import ProductColor from './product-colors.model';
import ProductColorsRepository from './product-colors.repository';
import ProductColorsService from './product-colors.service';

const ProductColorsOrmModule = TypeOrmModule.forFeature([ProductColor]);

@Module({
  controllers: [ProductColorsController],
  imports: [ProductColorsOrmModule],
  providers: [ProductColorsService, ProductColorsRepository],
  exports: [],
})
export default class ProductColorsModule {}
