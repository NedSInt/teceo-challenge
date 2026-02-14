import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createCacheOptions } from './cache/cache.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import ColorsModule from './modules/colors/colors.module';
import CustomersModule from './modules/customers/customers.module';
import OrderItemsModule from './modules/order-items/order-items.module';
import OrdersModule from './modules/orders/orders.module';
import ProductColorsModule from './modules/product-colors/product-colors.module';
import ProductSizesModule from './modules/product-sizes/product-sizes.module';
import ProductsModule from './modules/products/products.module';
import SkusModule from './modules/skus/skus.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: createCacheOptions,
    }),
    TypeOrmModule.forRootAsync({
      imports: [
        ConfigModule,
        ColorsModule,
        CustomersModule,
        OrdersModule,
        OrderItemsModule,
        ProductsModule,
        ProductSizesModule,
        ProductColorsModule,
        SkusModule,
      ],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
