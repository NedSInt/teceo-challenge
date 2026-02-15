import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import OrdersController from './orders.controller';
import Order from './orders.model';
import OrdersRepository from './orders.repository';
import OrdersService from './orders.service';

const OrdersOrmModule = TypeOrmModule.forFeature([Order]);

@Module({
  controllers: [OrdersController],
  imports: [OrdersOrmModule],
  providers: [OrdersRepository, OrdersService],
  exports: [],
})
export default class OrdersModule {}
