import { useWindowVirtualizer } from '@tanstack/react-virtual';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useLayoutEffect, useMemo, useRef } from 'react';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useOrdersList from '../hooks/useOrdersList';
import { OrderDTO } from '../interfaces/order.dto';
import OrdersListItem from './OrdersListItem';

const ROW_HEIGHT = 53;
const OVERSCAN_ROW_COUNT = 30;

const GRID_TEMPLATE_COLUMNS =
  '48px minmax(120px, 1.5fr) minmax(140px, 1.8fr) 100px 80px 100px 120px 100px 140px';

const baseRowSx = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  display: 'grid',
  gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
  willChange: 'transform' as const,
};

const OrdersList = () => {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    status,
    onChangeStatus,
    toggleOrderId,
    selectedOrderIds,
  } = useOrdersList();

  const parentRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  const selectedSet = useMemo(
    () => new Set(selectedOrderIds),
    [selectedOrderIds],
  );

  useLayoutEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      window.scrollTo(0, 0);
    }
  }, []);

  const loaderRef = useInfiniteScroll(fetchNextPage, !!hasNextPage, isFetchingNextPage);

  const orders = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? ([] as OrderDTO[]),
    [data?.pages]
  );

  const rowVirtualizer = useWindowVirtualizer({
    count: orders.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_ROW_COUNT,
    scrollMargin: 0,
    initialOffset: 0,
    getItemKey: (index) => orders[index]?.id ?? index,
  });

  if (status === 'pending') {
    return (
      <Grid container spacing={1}>
        {new Array(16).fill(1).map((_, index: number) => (
          <Grid size={12} key={index}>
            <Skeleton variant="rounded" width="100%" height={30} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (status === 'error') {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        }
      >
        Não foi possível carregar os pedidos. Verifique sua conexão e tente
        novamente.
      </Alert>
    );
  }

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div ref={parentRef}>
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box
          component="div"
          role="table"
          aria-label="orders list"
          sx={{ width: '100%' }}
        >
          <Box
            component="div"
            role="row"
            sx={{
              display: 'grid',
              gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
              width: '100%',
              position: 'sticky',
              top: 0,
              zIndex: 1,
              backgroundColor: 'background.paper',
              fontWeight: 600,
              borderBottom: 1,
              borderColor: 'divider',
              '& > div': {
                px: 1.5,
                py: 1,
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
              },
            }}
          >
            <Box component="div" role="columnheader" sx={{ justifyContent: 'flex-start' }} />
            <Box component="div" role="columnheader" sx={{ justifyContent: 'flex-start' }}><Typography color="text.secondary">cliente</Typography></Box>
            <Box component="div" role="columnheader" sx={{ justifyContent: 'flex-start' }}><Typography color="text.secondary">e-mail</Typography></Box>
            <Box component="div" role="columnheader" sx={{ justifyContent: 'flex-end' }}><Typography color="text.secondary">quantidade de produto-cor</Typography></Box>
            <Box component="div" role="columnheader" sx={{ justifyContent: 'flex-end' }}><Typography color="text.secondary">peças</Typography></Box>
            <Box component="div" role="columnheader" sx={{ justifyContent: 'flex-end' }}><Typography color="text.secondary">total</Typography></Box>
            <Box component="div" role="columnheader" sx={{ justifyContent: 'flex-end' }}><Typography color="text.secondary">valor médio por produto-cor</Typography></Box>
            <Box component="div" role="columnheader" sx={{ justifyContent: 'flex-end' }}><Typography color="text.secondary">valor médio por peça</Typography></Box>
            <Box component="div" role="columnheader" sx={{ justifyContent: 'flex-start' }}><Typography color="text.secondary">status</Typography></Box>
          </Box>
          <Box
            component="div"
            role="rowgroup"
            sx={{ position: 'relative', display: 'block', minHeight: rowVirtualizer.getTotalSize() }}
          >
            {virtualRows.map((virtualRow) => {
              const order = orders[virtualRow.index];
              if (!order) return null;
              return (
                <OrdersListItem
                  key={order.id}
                  order={order}
                  onToggle={toggleOrderId}
                  isToggled={selectedSet.has(order.id)}
                  onChangeStatus={onChangeStatus}
                  gridTemplateColumns={GRID_TEMPLATE_COLUMNS}
                  rowSx={{
                    ...baseRowSx,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                />
              );
            })}
          </Box>
        </Box>
      </Paper>

      {hasNextPage && (
        <Stack
          ref={loaderRef}
          alignItems="center"
          justifyContent="center"
          padding={3}
          gap={1}
          sx={{ minHeight: 80 }}
          aria-busy={isFetchingNextPage}
          aria-hidden={!isFetchingNextPage}
        >
          {isFetchingNextPage ? (
            <>
              <CircularProgress size={32} />
            </>
          ) : (
            <div style={{ height: 1 }} aria-hidden />
          )}
        </Stack>
      )}
    </div>
  );
};

export default OrdersList;
