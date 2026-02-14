#!/usr/bin/env node
/**
 * Executa diagnóstico do catálogo sem precisar do psql.
 * Uso: node scripts/run-diagnose-catalog.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const queries = [
  {
    title: '1. QUERY PRINCIPAL OTIMIZADA (products-first + CTE)',
    sql: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      WITH p_ordered AS MATERIALIZED (
        SELECT id, name FROM products p
        ORDER BY p.name ASC, p.id ASC
        LIMIT 200
      )
      SELECT pc.id
      FROM product_colors pc
      INNER JOIN p_ordered ON p_ordered.id = pc.product_id
      ORDER BY p_ordered.name ASC, pc.id ASC
      LIMIT 24 OFFSET 0
    `.trim(),
  },
  {
    title: '2. COUNT VIA pg_class (instantâneo, sem filtro)',
    sql: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT COALESCE(reltuples::bigint, 0) AS cnt
      FROM pg_class WHERE relname = 'product_colors'
    `.trim(),
  },
  {
    title: '3. QUERY DE COUNT EXATO (lento, seq scan)',
    sql: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT COUNT(1) FROM product_colors pc
      LEFT JOIN products p ON p.id = pc.product_id
    `.trim(),
  },
  {
    title: '4. QUERY DE PREÇOS (amostra)',
    sql: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT sku.product_color_id, MIN(sku.price)
      FROM skus sku
      WHERE sku.product_color_id IN (
        SELECT pc.id FROM product_colors pc
        JOIN products p ON p.id = pc.product_id
        ORDER BY p.name, pc.id
        LIMIT 24
      )
      GROUP BY sku.product_color_id
    `.trim(),
  },
];

async function run() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await client.connect();
    console.log('=== DIAGNÓSTICO DO CATÁLOGO ===\n');

    for (const { title, sql } of queries) {
      console.log(`\n${title}`);
      console.log('-'.repeat(60));
      const res = await client.query(sql);
      res.rows.forEach((r) => {
        const val = r['QUERY PLAN'] ?? r['query plan'] ?? Object.values(r)[0];
        console.log(val);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n5. ESTATÍSTICAS');
    const stats = await client.query(`
      SELECT relname AS tabela, n_live_tup AS linhas, last_analyze
      FROM pg_stat_user_tables
      WHERE relname IN ('product_colors', 'products', 'colors', 'skus')
      ORDER BY n_live_tup DESC
    `);
    console.table(stats.rows);

    console.log('\nO que observar: Execution Time, Seq Scan vs Index Scan, Buffers');
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
