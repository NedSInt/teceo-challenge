-- =============================================================================
-- DIAGNÓSTICO DE PERFORMANCE: Catálogo de produtos
-- =============================================================================
-- Execute no psql ou pgAdmin para identificar gargalos.
-- Parâmetros: limit=24, skip=0, productCodeOrName='' (vazio)
-- =============================================================================

\echo '=== 1. QUERY PRINCIPAL (dados) - product_colors + product + color ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  "productColor"."id",
  "productColor"."created_at",
  "productColor"."updated_at",
  "productColor"."product_id",
  "productColor"."color_id",
  "product"."id" AS "product_id",
  "product"."code" AS "product_code",
  "product"."name" AS "product_name",
  "product"."image_url" AS "product_image_url",
  "color"."id" AS "color_id",
  "color"."name" AS "color_name"
FROM "product_colors" "productColor"
LEFT JOIN "products" "product" ON "product"."id" = "productColor"."product_id"
LEFT JOIN "colors" "color" ON "color"."id" = "productColor"."color_id"
ORDER BY "product"."name" ASC, "productColor"."id" ASC
LIMIT 24 OFFSET 0;

\echo ''
\echo '=== 2. QUERY DE COUNT ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT COUNT(1) AS "cnt"
FROM "product_colors" "productColor"
LEFT JOIN "products" "product" ON "product"."id" = "productColor"."product_id";

\echo ''
\echo '=== 3. QUERY DE PREÇOS (24 IDs - simula após buscar dados) ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT sku.product_color_id AS "productColorId", MIN(sku.price) AS "minPrice"
FROM skus sku
WHERE sku.product_color_id IN (
  SELECT pc.id FROM product_colors pc
  LEFT JOIN products p ON p.id = pc.product_id
  ORDER BY p.name, pc.id
  LIMIT 24
)
GROUP BY sku.product_color_id;

\echo ''
\echo '=== 4. ESTATÍSTICAS DAS TABELAS ==='
SELECT
  relname AS tabela,
  n_live_tup AS linhas_approx,
  n_dead_tup AS linhas_mortas,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE relname IN ('product_colors', 'products', 'colors', 'skus')
ORDER BY n_live_tup DESC;

\echo ''
\echo '=== 5. ÍNDICES EM product_colors e products ==='
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('product_colors', 'products', 'skus')
  AND schemaname = 'public'
ORDER BY tablename;
