-- Extensão pg_trgm para buscas ILIKE eficientes em texto
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- products: buscas por código e nome
CREATE INDEX IF NOT EXISTS idx_products_code ON products (code);
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_code_gin ON products USING gin (code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name_gin ON products USING gin (name gin_trgm_ops);

-- customers: filtro da listagem de pedidos por nome ou e-mail
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers (email);
CREATE INDEX IF NOT EXISTS idx_customers_name_gin ON customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_email_gin ON customers USING gin (email gin_trgm_ops);

-- orders: join com customers e filtros por status
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

-- order_items: agrupamento por pedido e joins por SKU
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku_id ON order_items (sku_id);

-- product_colors: joins no catálogo e busca por produto
CREATE INDEX IF NOT EXISTS idx_product_colors_product_id ON product_colors (product_id);
CREATE INDEX IF NOT EXISTS idx_product_colors_color_id ON product_colors (color_id);

-- skus: join para preços e listagem por produto-cor
CREATE INDEX IF NOT EXISTS idx_skus_product_color_id ON skus (product_color_id);
