#!/usr/bin/env node
/**
 * Limpa o cache do Redis (banco atual).
 * Uso: node scripts/redis-flush.js   ou   yarn redis:flush
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const host = process.env.REDIS_HOST || 'localhost';
const port = process.env.REDIS_PORT || 6379;
const password = process.env.REDIS_PASSWORD || '';

async function flush() {
  let client;
  try {
    const { createClient } = await import('@redis/client');
    const url = password
      ? `redis://:${password}@${host}:${port}`
      : `redis://${host}:${port}`;

    client = createClient({ url });
    client.on('error', (err) => {
      console.error('Erro Redis:', err.message);
    });

    await client.connect();
    await client.flushDb();
    console.log('Redis limpo com sucesso (FLUSHDB).');
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' || err.message?.includes('@redis/client')) {
      console.log('Tentando redis-cli...');
      const { execSync } = require('child_process');
      try {
        const cmd = password
          ? `redis-cli -h ${host} -p ${port} -a ${password} FLUSHDB`
          : `redis-cli -h ${host} -p ${port} FLUSHDB`;
        execSync(cmd, { stdio: 'inherit' });
        console.log('Redis limpo com sucesso.');
      } catch (e) {
        console.error(
          'Redis CLI não encontrado. Opções:\n' +
            '  1. Instale redis-cli (Redis para Windows) ou use WSL\n' +
            '  2. Se usar Docker: docker exec -it <container> redis-cli FLUSHDB\n' +
            '  3. yarn add redis (para usar o cliente Node)',
        );
        process.exit(1);
      }
    } else {
      console.error('Erro:', err.message);
      process.exit(1);
    }
  } finally {
    if (client?.isOpen) {
      await client.quit();
    }
  }
}

flush();
