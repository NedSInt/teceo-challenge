-- Remover índices na ordem inversa

-- skus
DROP INDEX IF EXISTS idx_skus_product_color_id;

-- product_colors
DROP INDEX IF EXISTS idx_product_colors_color_id;
DROP INDEX IF EXISTS idx_product_colors_product_id;

-- order_items
DROP INDEX IF EXISTS idx_order_items_sku_id;
DROP INDEX IF EXISTS idx_order_items_order_id;

-- orders
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_customer_id;

-- customers
DROP INDEX IF EXISTS idx_customers_email_gin;
DROP INDEX IF EXISTS idx_customers_name_gin;
DROP INDEX IF EXISTS idx_customers_email;
DROP INDEX IF EXISTS idx_customers_name;

-- products
DROP INDEX IF EXISTS idx_products_name_gin;
DROP INDEX IF EXISTS idx_products_code_gin;
DROP INDEX IF EXISTS idx_products_name;
DROP INDEX IF EXISTS idx_products_code;
