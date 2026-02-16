# CHANGES.md — Documentação das melhorias de performance

Este documento descreve **todas as alterações** realizadas para otimizar o desempenho do catálogo de produtos e da listagem de pedidos. Cada mudança inclui o contexto, a estratégia utilizada e o impacto esperado.

---

## Sumário executivo

| Área | Antes | Depois | Impacto |
|-----|-------|--------|---------|
| **Query principal do catálogo** | Seq Scan 7M linhas (~6,4 s) | Index Scan + CTE (~6 ms) | ~1000x mais rápido |
| **Count do catálogo** | Seq Scan 7M linhas (~450 ms) | pg_class (~0,08 ms) | ~5000x mais rápido |
| **Preço mínimo por produto-cor** | N+1 ou JOIN pesado | Uma query com `MIN(price)` | Eliminou N queries |
| **Totais dos pedidos** | Carregar todos os itens + calcular em JS | 1 query agregada (SUM, COUNT DISTINCT, GROUP BY) | Menos dados e CPU na aplicação |
| **Listagem de pedidos — query** | 3 round-trips (orders, count, totals) | 1 query CTE unificada + count só na 1ª página | Menos round-trips e latência |
| **Listagem de pedidos — paginação** | OFFSET (lento em páginas avançadas) | Cursor (`WHERE id > :cursor`) nas páginas seguintes | Escala para milhões |
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

## 2. Backend — Catálogo de produtos

### 2.1 Eliminação de N+1 — cores e preços

**Problema original:** Para cada produto-cor da página, o código executava:
- `getColorsForProductColors`: 1 query por item para carregar a cor
- `getPricesForProductColors`: 1 query por item para carregar SKUs e calcular preço mínimo

Com 10 itens = 20+ queries extras; com 50 = 100+ extras.

**Solução:**
- **Cores:** `leftJoinAndSelect('productColor.color', 'color')` na query principal — já carregadas no fetch.
- **Preços:** Método `getMinPricesByProductColorIds(ids)` em **ProductColorsRepository** executa **uma única query** com `MIN(sku.price) GROUP BY sku.product_color_id` para todos os IDs da página, e retorna um `Map<id, minPrice>`.
- **SKUs não são mais carregados** na listagem; apenas o preço mínimo é utilizado. Isso evita trafegar milhares de registros desnecessários.

### 2.2 Query principal — estratégia "products-first" com CTE

**Problema:** A query original partia de `product_colors` (7M linhas), fazia `LEFT JOIN products` e `LEFT JOIN colors`, e aplicava `ORDER BY product.name`. O PostgreSQL precisava:
1. Fazer Seq Scan em 7M linhas em `product_colors`
2. Fazer Hash Join com 2M linhas em `products`
3. Ordenar ~7M linhas em disco (temp read/write massivo)
4. Só então aplicar LIMIT 24

Tempo: ~6,4 segundos.

**Solução:** Inverter a lógica — partir de `products` ordenados por nome e limitar o escopo antes do join. CTE `p_ordered AS MATERIALIZED` limita produtos (~95–5000), depois join com `product_colors` via índice `idx_product_colors_product_id`. Index Scan em vez de Seq Scan; processa centenas de linhas em vez de milhões. Tempo: ~6 ms.

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

- **Chave:** `product-colors:{limit}:{skip}:{search}` (limit padrão: 12)
- **TTL:** 5 minutos (configurável via `REDIS_TTL_SECONDS`)
- **Fallback:** Se Redis estiver indisponível, usa cache em memória (NestJS)
- **`cache.set` não bloqueia:** A resposta é enviada imediatamente após `fetchFromDatabase`; o `cache.set` roda em background. Isso evita que latência do Redis aumente o tempo de resposta.

### 2.6 Sanitização de productCodeOrName

**Problema:** Parâmetros malformados (ex.: fragmentos de URL como `?limit=10&skip=0`) chegavam como `productCodeOrName`, gerando buscas lentas ou inesperadas.

**Solução:** Uso de `@Transform` do `class-transformer` para tratar `productCodeOrName` que contenha `?` ou `=` como `undefined`, efetivamente ignorando a busca.

### 2.7 ProductColorsRepository — separação de responsabilidades

**Problema:** O `ProductColorsService` concentrava queries raw SQL (CTE, pg_class, preços mínimos) junto à orquestração e cache.

**Solução:** Nova camada **ProductColorsRepository** que encapsula: `fetchDataOptimized` (CTE products-first), `getCountFromStats` (pg_class), `getCountWithFilter` (count com busca), `getMinPricesByProductColorIds`. O service mantém apenas cache e orquestração (`fetchFromDatabase`, `list`). Arquitetura alinhada com `OrdersRepository`.

---

## 3. Backend — Listagem de pedidos

### 3.1 Totais por pedido — query agregada no banco

**Problema:** Para cada pedido da página era executada uma query para buscar `order_items` (N+1). Em uma segunda etapa, passou-se a uma única query que trazia **todos** os itens dos 50 pedidos com joins em `sku` e `productColor`, montando um `Map<orderId, OrderItem[]>` em memória e calculando totais em JavaScript. Isso trafegava centenas de linhas e consumia memória e CPU na aplicação.

**Solução:**
- Novo método em **OrderItemsService:** `getTotalsByOrderIds(orderIds)`, que executa **uma única query agregada** em SQL:
  - `SUM(oi.quantity * s.price)` → valor total
  - `SUM(oi.quantity)` → quantidade total
  - `COUNT(DISTINCT s.product_color_id)` → quantidade de produto-cor
  - `GROUP BY oi.order_id` e `WHERE oi.order_id = ANY($1)`
- O resultado é **uma linha por pedido** (ex.: 50 linhas para 50 pedidos). A aplicação só faz o merge com a lista de pedidos e calcula as médias (valor médio por peça e por produto-cor) em memória.
- **Benefícios:** Menos dados trafegados, menos uso de memória e de CPU; o trabalho pesado fica no banco, aproveitando índices em `order_items` e `skus`.

### 3.2 Atualização em massa (batchUpdate)

**Problema:** `batchUpdate` executava um `UPDATE` por `orderId` em loop.

**Solução:** Um único `UPDATE orders SET ... WHERE id IN (:...orderIds)` usando `In(orderIds)` do TypeORM.

### 3.3 Query unificada — CTE (orders + customer + totals em 1 round-trip)

**Problema:** A listagem de pedidos fazia 3 round-trips ao banco:
1. `getManyAndCount` → SELECT de orders + customer e COUNT separado
2. `getTotalsByOrderIds` → agregação de order_items para os 50 pedidos

Com latência de rede, isso somava centenas de milissegundos (ex.: ~900 ms para skip=500).

**Solução:** Uma única query com CTE `paged` (ids da página) + join com orders, customers e subquery agregada de totais. Reduz 3 round-trips para 1. Queries raw em **OrdersRepository**; `OrderItemsService` deixou de ser injetado no `OrdersService` para essa rota.

### 3.4 Paginação por cursor (substitui OFFSET nas páginas seguintes)

**Problema:** `OFFSET 500` (ou maior) obriga o PostgreSQL a percorrer e descartar 500+ linhas antes de retornar o bloco. Com milhões de registros, isso degrada.

**Solução:** Novo parâmetro `cursor` (UUID do último pedido da página anterior). Quando informado:
- `WHERE o.id > :cursor ORDER BY o.id ASC LIMIT :limit`
- Uso direto de índice em `id` (PK), sem OFFSET.

- **API:** `GET /orders?limit=50&cursor=<uuid>&customerNameOrEmail=...`
- **Primeira página:** sem `cursor`; usa `OFFSET 0` normalmente.

### 3.5 COUNT apenas na primeira página

**Problema:** `COUNT(*)` com filtros e joins pode ser custoso e era executado em toda requisição.

**Solução:** O count é calculado **apenas** na primeira página (`skip=0` e sem `cursor`). Nas demais, a resposta traz apenas `{ data }`, sem `count`. O frontend mantém o total usando o `count` da primeira página.

### 3.6 Execução paralela (data + count na primeira página)

**Problema:** Na primeira página, data e count eram obtidos em sequência pelo `getManyAndCount` do TypeORM.

**Solução:** `Promise.all([ordersRepository.fetchOrdersWithTotals(...), ordersRepository.countOrders(...)])` — data e count são buscados em paralelo, reduzindo o tempo total de resposta.

### 3.7 Refatoração — OrdersRepository e separação de responsabilidades

**Problema:** O `OrdersService` concentrava lógica de persistência (queries raw SQL) junto à orquestração de negócio, dificultando testes e manutenção.

**Solução:**
- **OrdersRepository:** Nova camada que encapsula as queries raw (`fetchOrdersWithTotals`, `countOrders`). Contém `buildWhereClause`, `mapRowsToDto` e a interface interna `RawOrderRow`.
- **OrdersService:** Passa a delegar ao repository; mantém apenas orquestração (list, update, batchUpdate). Removido `createQueryBuilder` (código morto).
- **list-orders-response.dto.ts:** Interface `ListOrdersResult` movida para DTO dedicado.
- **orders.constants.ts:** Constante `DEFAULT_ORDER_LIMIT = 50` centralizada.

---

## 4. Backend — Redis e cache

### 4.1 Configuração

- **Biblioteca:** `@keyv/redis` (compatível com `cache-manager` do NestJS)
- **Namespace:** `teceo-cache`
- **Variáveis de ambiente:** `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TTL_SECONDS`
- **Fallback:** Se a conexão com Redis falhar, o NestJS usa cache em memória automaticamente.

---

## 5. Frontend — Catálogo de produtos

### 5.1 Tamanho da página (page size)

- **Valor:** 12 itens por página (constante `PRODUCT_COLORS_PAGE_SIZE` no frontend / `DEFAULT_PRODUCT_COLORS_LIMIT` no backend).
- **Consistência:** Backend e frontend usam o mesmo valor (12), evitando divergência.

### 5.2 Virtualização (useWindowVirtualizer)

- **Problema:** Com infinite scroll, todos os itens entrariam no DOM; o scroll poderia pesar.
- **Solução:** `@tanstack/react-virtual` com **useWindowVirtualizer** usando scroll da página (window). Grid por linhas de 4 cards (`COLS = 4`), `overscan: 6`, `getItemKey` estável, `scrollMargin` com ResizeObserver. Hooks antes de early returns (regras do React).

### 5.3 React Query — staleTime e gcTime

```ts
staleTime: 60 * 1000,   // 1 minuto — dados considerados "frescos"
gcTime: 5 * 60 * 1000,  // 5 minutos — tempo que dados inativos permanecem em cache
```

- Evita refetch desnecessário ao voltar para a tela ou redimensionar a janela.
- Diminui requisições redundantes ao servidor.

### 5.4 Uso do count da API

- `getNextPageParam` usa `lastPage.count` para saber se há mais páginas, em vez de depender só de "última página vazia".
- Exibição de "X de Y resultados" usando o `count` retornado pela API.

### 5.5 Memoização de `HomeProductColorListItem`

- Componente envolvido com `React.memo` para evitar re-renders quando o pai atualiza sem mudar os dados do item.
- Relevante em listas grandes com infinite scroll.

### 5.6 Parâmetros condicionais na API

- `productCodeOrName` é enviado **apenas** quando há termo de busca válido (não vazio).
- Evita parâmetros vazios ou malformados e simplifica a chave de cache no backend.

---

## 6. Frontend — Listagem de pedidos

### 6.1 Virtualização (useWindowVirtualizer)

- Mesmo padrão da seção 5.2: scroll da página (window), tabela em fluxo no documento (sem `TableContainer` com scroll próprio). `overscan: 30`, `getItemKey` por `orders[index]?.id`, `willChange: 'transform'`. Paper + Table com `stickyHeader`.

### 6.2 Load more — IntersectionObserver e loading no final

- **Problema:** O div “loader” do infinite scroll ficava **fora** da tabela e sempre visível na viewport; o IntersectionObserver disparava em loop, gerando requisições desnecessárias.
- **Solução:** Loader no final da lista, no fluxo da página. "Load more" só dispara quando o usuário rola até o fim. Durante `isFetchingNextPage`, exibe CircularProgress

### 6.3 React Query: menos requisições e UX mais fluida

- **Remoção do loading global:** O `queryFn` da lista de pedidos **não** chama mais `handleLoadingStatus()` do contexto. O loading fica restrito ao estado da query (skeleton na própria lista), evitando spinner no header e re-renders em cascata.
- **refetchOnWindowFocus: false** e **staleTime: 5 minutos** na query de pedidos — menos refetches ao focar na janela ou ao voltar na rota.
- **placeholderData: keepPreviousData** — ao mudar busca ou ao refetch, a lista anterior permanece visível até os novos dados chegarem, evitando “piscar” e sensação de lentidão.

### 6.4 Callbacks estáveis e memoização

- **useOrdersList:** `onChangeStatus` e `toggleOrderId` envolvidos em **useCallback**; para não depender de `selectedOrderIds` em `onChangeStatus` (evitando nova referência a cada toggle), usa-se um **ref** que espelha `selectedOrderIds`, mantendo a referência do callback estável.
- **OrdersListItem** continua com **React.memo**; com as props de função estáveis, os itens não re-renderizam desnecessariamente ao interagir com a lista.

### 6.5 Indicador "X de Y pedidos"

- Exibe quantos pedidos foram carregados em relação ao total, usando o `count` retornado pela API.
- **Atualização:** O `count` é retornado apenas na primeira página; o frontend usa `pages[0]?.count` para o total, garantindo que o indicador funcione mesmo sem count nas páginas seguintes.

### 6.6 Paginação por cursor (cursor-based pagination)

- **Problema:** Com paginação por offset (`skip`), o backend recebia `skip=0`, `skip=50`, `skip=100`, etc. Em páginas avançadas (ex.: skip=500), a query ficava lenta.
- **Solução:**
  - **initialPageParam: undefined** — primeira requisição sem parâmetro de página.
  - **getNextPageParam** retorna `lastPage.data[lastPage.data.length - 1]?.id` (UUID do último pedido) em vez do número da página.
  - O repositório envia `cursor=<uuid>` nas requisições seguintes, em vez de `skip`.
  - O backend usa `WHERE id > :cursor`, mais eficiente que OFFSET.
- **Interface PageDTO:** `count` passou a ser opcional (`count?: number`), pois nas páginas 2+ o backend não retorna count.

### 6.7 Tratamento de count opcional

- `getNextPageParam` verifica `lastPage.count != null` antes de comparar com `totalLoaded`, para suportar respostas sem count.
- `useHomeProductColorList` foi ajustado da mesma forma, pois usa o mesmo `PageDTO`.

### 6.8 Constantes e UI de erro

- **orders.constants.ts:** `ORDERS_PAGE_SIZE = 50` centralizada; usada em `orders.repository.ts` e `useOrdersList.ts` (evita duplicação).
- **UI de erro:** Substituído `<p>error</p>` por `Alert` do MUI com mensagem clara e botão "Tentar novamente" que chama `refetch()` para nova tentativa.

---

## 7. Variáveis de ambiente

Para o backend, além das variáveis de banco existentes, foram adicionadas:

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `REDIS_HOST` | Host do Redis | `localhost` |
| `REDIS_PORT` | Porta do Redis | `6379` |
| `REDIS_PASSWORD` | Senha (opcional) | — |
| `REDIS_TTL_SECONDS` | TTL do cache em segundos | `300` (5 min) |

---

## 8. Resumo de arquivos modificados/criados

### Backend
- `src/modules/product-colors/product-colors.repository.ts` —  Encapsula fetchDataOptimized, getCountFromStats, getCountWithFilter, getMinPricesByProductColorIds
- `src/modules/product-colors/product-colors.service.ts` — Orquestração e cache; delega persistência ao repository
- `src/modules/product-colors/product-colors.constants.ts` —  `DEFAULT_PRODUCT_COLORS_LIMIT = 12`, `CACHE_KEY_PREFIX`, `CACHE_TTL_MS`, `COUNT_CACHE_TTL_MS`
- `src/modules/product-colors/dtos/list-product-colors.filter.ts` — Sanitização de productCodeOrName; documentação createWhere/paginate
- `src/modules/product-colors/product-colors.module.ts` — ProductColorsRepository nos providers
- `commons/filters/base.filter.ts` — Documentação createWhere e paginate
- `src/modules/orders/orders.service.ts` — Totais por pedido via query agregada, batchUpdate; orquestração com OrdersRepository; query unificada (CTE), paginação por cursor, count só na 1ª página, execução paralela
- `src/modules/orders/orders.repository.ts` — Queries raw (fetchOrdersWithTotals, countOrders); encapsula persistência da listagem
- `src/modules/orders/orders.constants.ts` — `DEFAULT_ORDER_LIMIT = 50`
- `src/modules/orders/dtos/list-orders.filter.ts` — Novo parâmetro opcional `cursor` (UUID) para paginação
- `src/modules/orders/dtos/list-orders-response.dto.ts` — Interface `ListOrdersResult`
- `src/modules/orders/orders.module.ts` — Remoção de `OrderItemsModule`; adição de `OrdersRepository` aos providers
- `src/modules/order-items/order-items.service.ts` — Novo método `getTotalsByOrderIds` (query agregada)
- `src/app.module.ts` — Cache Redis
- `src/cache/cache.config.ts` — Configuração do cache (Redis + fallback em memória)
- `migrations/sqls/20260214135759-add-performance-indexes-up.sql` — Índices
- `migrations/20260214135759-add-performance-indexes.js` — Migration

### Frontend
- `src/App.tsx` — QueryClient com staleTime/gcTime
- `src/modules/home/home.constants.ts` — `PRODUCT_COLORS_PAGE_SIZE = 12`
- `src/modules/home/repositories/home.repository.ts` — Params condicionais; usa `PRODUCT_COLORS_PAGE_SIZE`
- `src/modules/home/components/HomeProductColorList.tsx` — Virtualização com **useWindowVirtualizer** (scroll da página), grid por linhas (COLS=4, overscan 6), scrollMargin com ResizeObserver; UI de erro com Alert + botão "Tentar novamente"
- `src/modules/home/components/HomeProductColorListItem.tsx` — memo
- `src/modules/orders/components/OrdersList.tsx` — Virtualização com **useWindowVirtualizer** (scroll da página), sem TableContainer com scroll próprio; Paper + Table com stickyHeader; overscan 30, getItemKey; loader no final da lista com loading visível ("Carregando mais pedidos..."); totalCount usa `pages[0]?.count`; UI de erro com Alert + botão "Tentar novamente"
- `src/modules/orders/components/OrdersListItem.tsx` — memo
- `src/modules/orders/hooks/useOrdersList.ts` — React Query (staleTime, refetchOnWindowFocus, placeholderData), callbacks em useCallback, ref para selectedOrderIds; paginação por cursor (initialPageParam undefined, getNextPageParam retorna lastOrder.id); usa ORDERS_PAGE_SIZE
- `src/modules/orders/repositories/orders.repository.ts` — Aceita `cursor` (string) ou página (number); envia parâmetro adequado na URL; usa ORDERS_PAGE_SIZE
- `src/modules/orders/orders.constants.ts` — `ORDERS_PAGE_SIZE = 50`
- `src/interfaces/page.interface.ts` — `PageDTO.count` opcional
- `src/modules/home/components/hooks/useHomeProductColorList.ts` — Tratamento de `lastPage.count` possivelmente undefined
- `src/modules/global/contexts/ApplicationContext.tsx` — Interface `ApplicationContextProps` unificada (remoção de duplicata)
- `src/hooks/useInfiniteScroll.ts` — Parâmetro opcional `scrollRootRef` para usar o container de scroll como root do IntersectionObserver