# CHANGES.md — Documentação das melhorias de performance

Este documento descreve **todas as alterações** realizadas para otimizar o desempenho do catálogo de produtos e da listagem de pedidos. Cada mudança inclui o contexto, a estratégia utilizada e o impacto esperado.

---

## Sumário executivo

| Área | Antes | Depois | Impacto |
|-----|-------|--------|---------|
| **Query principal do catálogo** | Seq Scan 7M linhas (~6,4 s) | Index Scan + CTE (~6 ms) | ~1000x mais rápido |
| **Count do catálogo** | Seq Scan 7M linhas (~450 ms) | pg_class (~0,08 ms) | ~5000x mais rápido |
| **Preço mínimo por produto-cor** | N+1 ou JOIN pesado | Uma query com `MIN(price)` | Eliminou N queries |
| **Itens dos pedidos** | N queries (1 por pedido) | 1 query com `IN (:...orderIds)` | Eliminou N-1 queries |
| **Atualização em massa** | N `UPDATE`s | 1 `UPDATE` com `IN` | Redução drástica de round-trips |
| **Cache do catálogo** | — | Redis (5 min TTL) | Respostas em ~10 ms após warm-up |

---

## 1. Banco de dados — índices

### 1.1 Migration de índices

**Arquivo:** `backend/migrations/sqls/20260214135759-add-performance-indexes-up.sql`

**Problema:** Colunas usadas em filtros, buscas e joins não tinham índices, causando full table scan em tabelas grandes (milhões de linhas).

**Solução:** Criação de índices B-tree e GIN em todas as tabelas relevantes:

| Tabela | Índices | Propósito |
|--------|---------|-----------|
| **products** | `idx_products_code`, `idx_products_name`, `idx_products_code_gin`, `idx_products_name_gin` | Busca por código/nome e suporte a ILIKE |
| **customers** | `idx_customers_name`, `idx_customers_email`, GIN em ambos | Filtro da listagem de pedidos |
| **orders** | `idx_orders_customer_id`, `idx_orders_status` | Join e filtros por status |
| **order_items** | `idx_order_items_order_id`, `idx_order_items_sku_id` | Agrupamento e joins |
| **product_colors** | `idx_product_colors_product_id`, `idx_product_colors_color_id` | Join no catálogo |
| **skus** | `idx_skus_product_color_id` | Join para cálculo de preço mínimo |

### 1.2 Extensão pg_trgm

**Problema:** Buscas `ILIKE '%termo%'` não usam índice B-tree tradicional (o `%` no início invalida o índice).

**Solução:** Uso da extensão PostgreSQL `pg_trgm` e índices GIN em colunas de texto (`products.code`, `products.name`, `customers.name`, `customers.email`). Isso permite buscas por similaridade e prefixo/sufixo de forma eficiente.

---

## 2. Backend — Catálogo de produtos (ProductColorsService)

### 2.1 Eliminação de N+1 — cores e preços

**Problema original:** Para cada produto-cor da página, o código executava:
- `getColorsForProductColors`: 1 query por item para carregar a cor
- `getPricesForProductColors`: 1 query por item para carregar SKUs e calcular preço mínimo

Com 10 itens = 20+ queries extras; com 50 = 100+ extras.

**Solução:**
- **Cores:** `leftJoinAndSelect('productColor.color', 'color')` na query principal — já carregadas no fetch.
- **Preços:** Nova função `getMinPricesByProductColorIds(ids)` que executa **uma única query** com `MIN(sku.price) GROUP BY sku.product_color_id` para todos os IDs da página, e retorna um `Map<id, minPrice>`.
- **SKUs não são mais carregados** na listagem; apenas o preço mínimo é utilizado. Isso evita trafegar milhares de registros desnecessários.

### 2.2 Query principal — estratégia "products-first" com CTE

**Problema:** A query original partia de `product_colors` (7M linhas), fazia `LEFT JOIN products` e `LEFT JOIN colors`, e aplicava `ORDER BY product.name`. O PostgreSQL precisava:
1. Fazer Seq Scan em 7M linhas em `product_colors`
2. Fazer Hash Join com 2M linhas em `products`
3. Ordenar ~7M linhas em disco (temp read/write massivo)
4. Só então aplicar LIMIT 24

Tempo: ~6,4 segundos.

**Solução:** Inverter a lógica — partir de `products` ordenados por nome e limitar o escopo antes do join:

```sql
WITH p_ordered AS MATERIALIZED (
  SELECT id, name FROM products p
  [WHERE ...]  -- filtro de busca, se houver
  ORDER BY p.name ASC, p.id ASC
  LIMIT 200   -- ~(skip + limit) * 2 para cobrir paginação
)
SELECT pc.id, ...
FROM product_colors pc
INNER JOIN p_ordered ON p_ordered.id = pc.product_id
ORDER BY p_ordered.name ASC, pc.id ASC
LIMIT 24 OFFSET skip
```

- **`MATERIALIZED`:** Força o PostgreSQL a executar a CTE primeiro (95–5000 produtos), e só depois fazer o join com `product_colors` via índice `idx_product_colors_product_id`.
- **Resultado:** Index Scan em `products` e Index Scan em `product_colors`; processa apenas centenas de linhas em vez de milhões.
- **Tempo:** ~6 ms.

### 2.3 Count — pg_class.reltuples (sem filtro)

**Problema:** `COUNT(*)` em `product_colors` com join em `products` (quando há filtro) ou sem filtro exigia Seq Scan em 7M linhas. Tempo: ~450 ms.

**Solução para listagem sem busca:**
- Usar `pg_class.reltuples`, que armazena estimativa de linhas mantida pelo PostgreSQL (atualizada por `ANALYZE`, `VACUUM`).
- Query: `SELECT reltuples::bigint FROM pg_class WHERE relname = 'product_colors'`
- Tempo: ~0,08 ms.
- **Observação:** O valor é estimado (erro típico de 1–2%). Adequado para indicadores como "X de ~7M resultados".

**Quando há filtro de busca:** Mantém-se o count exato, mas com cache (ver próximo item).

### 2.4 Cache do count

- **Sem busca:** Count via `pg_class` é cacheado por **30 minutos** (chave: `product-colors:count:`).
- **Com busca:** Count exato é cacheado por **5 minutos** (chave: `product-colors:count:termo`).
- Evita repetir o Seq Scan (ou a leitura de stats) em requisições consecutivas com os mesmos parâmetros.

### 2.5 Cache Redis da listagem

- **Chave:** `product-colors:{limit}:{skip}:{search}`
- **TTL:** 5 minutos (configurável via `REDIS_TTL_SECONDS`)
- **Fallback:** Se Redis estiver indisponível, usa cache em memória (NestJS)
- **`cache.set` não bloqueia:** A resposta é enviada imediatamente após `fetchFromDatabase`; o `cache.set` roda em background. Isso evita que latência do Redis aumente o tempo de resposta.

### 2.6 Sanitização de productCodeOrName

**Problema:** Parâmetros malformados (ex.: fragmentos de URL como `?limit=24&skip=0`) chegavam como `productCodeOrName`, gerando buscas lentas ou inesperadas.

**Solução:** Uso de `@Transform` do `class-transformer` para tratar `productCodeOrName` que contenha `?` ou `=` como `undefined`, efetivamente ignorando a busca.

---

## 3. Backend — Listagem de pedidos (OrdersService)

### 3.1 Eliminação de N+1 — itens dos pedidos

**Problema:** Para cada pedido da página, era executada uma query para buscar `order_items` com join em `sku` e `productColor`. Com 50 pedidos = 50 queries adicionais.

**Solução:**
- Uma única query: `order_items` com `WHERE order.id IN (:...orderIds)` (lista de IDs da página atual).
- Join com `sku` e `productColor` na mesma query.
- Montagem de um `Map<orderId, OrderItem[]>` em memória.
- Cálculo dos totais (valor, quantidade, produto-cor distintos, médias) por pedido a partir desse mapa, sem novas idas ao banco.

### 3.2 Atualização em massa (batchUpdate)

**Problema:** `batchUpdate` executava um `UPDATE` por `orderId` em loop.

**Solução:** Um único `UPDATE orders SET ... WHERE id IN (:...orderIds)` usando `In(orderIds)` do TypeORM.

---

## 4. Backend — Redis e cache

### 4.1 Configuração

- **Biblioteca:** `@keyv/redis` (compatível com `cache-manager` do NestJS)
- **Namespace:** `teceo-cache`
- **Variáveis de ambiente:** `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TTL_SECONDS`
- **Fallback:** Se a conexão com Redis falhar, o NestJS usa cache em memória automaticamente.

---

## 5. Backend — Utilitários

### 5.1 Scripts adicionados

| Script | Comando | Descrição |
|--------|---------|-----------|
| Diagnóstico do catálogo | `yarn diagnose:catalog` | Executa `EXPLAIN (ANALYZE)` nas queries do catálogo e mostra estatísticas das tabelas |
| Atualizar estatísticas | `yarn analyze` | Executa `ANALYZE` nas tabelas principais (products, product_colors, skus, etc.) |
| Limpar Redis | `yarn redis:flush` | Executa `FLUSHDB` no Redis configurado |

---

## 6. Frontend — Catálogo de produtos

### 6.1 Tamanho da página (page size)

- **Antes:** 10 itens por página
- **Depois:** 24 itens por página
- **Motivo:** Reduz o número de requisições para preencher a tela e aproveita melhor a capacidade de resposta da API otimizada.

### 6.2 React Query — staleTime e gcTime

```ts
staleTime: 60 * 1000,   // 1 minuto — dados considerados "frescos"
gcTime: 5 * 60 * 1000,  // 5 minutos — tempo que dados inativos permanecem em cache
```

- Evita refetch desnecessário ao voltar para a tela ou redimensionar a janela.
- Diminui requisições redundantes ao servidor.

### 6.3 Uso do count da API

- `getNextPageParam` usa `lastPage.count` para saber se há mais páginas, em vez de depender só de "última página vazia".
- Exibição de "X de Y resultados" usando o `count` retornado pela API.

### 6.4 Memoização de `HomeProductColorListItem`

- Componente envolvido com `React.memo` para evitar re-renders quando o pai atualiza sem mudar os dados do item.
- Relevante em listas grandes com infinite scroll.

### 6.5 Parâmetros condicionais na API

- `productCodeOrName` é enviado **apenas** quando há termo de busca válido (não vazio).
- Evita parâmetros vazios ou malformados e simplifica a chave de cache no backend.

---

## 7. Frontend — Listagem de pedidos

### 7.1 Virtualização com @tanstack/react-virtual

- **Problema:** Com infinite scroll, todos os itens carregados ficam no DOM. Em centenas de linhas, isso aumenta custo de layout e memória.
- **Solução:** Uso de `useVirtualizer` para renderizar apenas as linhas visíveis (e um buffer — `overscan: 5`).
- A tabela mantém altura virtual total; apenas as linhas visíveis são montadas no DOM.

### 7.2 Memoização de `OrdersListItem`

- Componente envolvido com `React.memo` para reduzir re-renders em listas longas.
- Props estáveis (`onChangeStatus`, `toggleOrderId`) evitam re-criação desnecessária.

### 7.3 Indicador "X de Y pedidos"

- Exibe quantos pedidos foram carregados em relação ao total, usando o `count` retornado pela API.

---

## 8. Variáveis de ambiente

Para o backend, além das variáveis de banco existentes, foram adicionadas:

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `REDIS_HOST` | Host do Redis | `localhost` |
| `REDIS_PORT` | Porta do Redis | `6379` |
| `REDIS_PASSWORD` | Senha (opcional) | — |
| `REDIS_TTL_SECONDS` | TTL do cache em segundos | `300` (5 min) |

---

## 9. Resumo de arquivos modificados/criados

### Backend
- `src/modules/product-colors/product-colors.service.ts` — Query otimizada, cache, count via pg_class
- `src/modules/product-colors/dtos/list-product-colors.filter.ts` — Sanitização de productCodeOrName
- `src/modules/orders/orders.service.ts` — N+1 removido, batchUpdate
- `src/app.module.ts` — Cache Redis
- `src/cache/cache.config.ts` — Configuração do cache (Redis + fallback em memória)
- `migrations/sqls/20260214135759-add-performance-indexes-up.sql` — Índices
- `migrations/20260214135759-add-performance-indexes.js` — Migration
- `scripts/run-diagnose-catalog.js` — Diagnóstico
- `scripts/run-analyze.js` — ANALYZE
- `scripts/redis-flush.js` — Limpeza do Redis

### Frontend
- `src/App.tsx` — QueryClient com staleTime/gcTime
- `src/modules/home/repositories/home.repository.ts` — Params condicionais
- `src/modules/home/components/HomeProductColorListItem.tsx` — memo
- `src/modules/orders/components/OrdersList.tsx` — Virtualização
- `src/modules/orders/components/OrdersListItem.tsx` — memo
