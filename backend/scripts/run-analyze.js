#!/usr/bin/env node
/**
 * Atualiza estatísticas das tabelas do catálogo para melhorar o plano de execução.
 * Execute após inserções em massa ou periodicamente.
 * Uso: node scripts/run-analyze.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const TABLES = ['products', 'product_colors', 'colors', 'skus', 'customers', 'orders', 'order_items'];

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
    console.log('=== ANALYZE das tabelas ===\n');

    for (const table of TABLES) {
      await client.query(`ANALYZE ${table}`);
      console.log(`  ANALYZE ${table} - OK`);
    }

    console.log('\nEstatísticas atualizadas.');
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
