import { useWindowVirtualizer } from '@tanstack/react-virtual';
import {
  Alert,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useOrdersList from '../hooks/useOrdersList';
import { OrderDTO } from '../interfaces/order.dto';
import OrdersListItem from './OrdersListItem';

const ROW_HEIGHT = 53;
const OVERSCAN_ROW_COUNT = 30;

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
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setScrollMargin(rect.top + window.scrollY);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const loaderRef = useInfiniteScroll(fetchNextPage, !!hasNextPage, isFetchingNextPage);

  const orders = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? ([] as OrderDTO[]),
    [data?.pages]
  );
  const totalCount =
    data?.pages[0]?.count ?? data?.pages[data.pages.length - 1]?.count ?? 0;

  const rowVirtualizer = useWindowVirtualizer({
    count: orders.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_ROW_COUNT,
    scrollMargin,
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
      {totalCount > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {orders.length} de {totalCount} pedidos
        </Typography>
      )}
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Table size="small" aria-label="orders list" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell variant="head">
                <Typography>cliente</Typography>
              </TableCell>
              <TableCell variant="head">
                <Typography>e-mail</Typography>
              </TableCell>
              <TableCell variant="head" align="right">
                <Typography>quantidade de produto-cor</Typography>
              </TableCell>
              <TableCell variant="head" align="right">
                <Typography>peças</Typography>
              </TableCell>
              <TableCell variant="head" align="right">
                <Typography>total</Typography>
              </TableCell>
              <TableCell variant="head" align="right">
                <Typography>valor médio por produto-cor</Typography>
              </TableCell>
              <TableCell variant="head" align="right">
                <Typography>valor médio por peça</Typography>
              </TableCell>
              <TableCell variant="head">
                <Typography>status</Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody sx={{ position: 'relative' }}>
            <TableRow>
              <TableCell
                colSpan={9}
                sx={{
                  height: rowVirtualizer.getTotalSize(),
                  padding: 0,
                  border: 0,
                  lineHeight: 0,
                }}
              />
            </TableRow>
            {virtualRows.map((virtualRow) => {
              const order = orders[virtualRow.index];
              if (!order) return null;
              return (
                <OrdersListItem
                  key={order.id}
                  item={OrderDTO.toListItem(order)}
                  onToggle={toggleOrderId}
                  isToggled={selectedOrderIds.includes(order.id)}
                  onChangeStatus={onChangeStatus}
                  orderId={order.id}
                  rowSx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                    willChange: 'transform',
                  }}
                />
              );
            })}
          </TableBody>
        </Table>
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
              <Typography variant="body2" color="text.secondary">
                Carregando mais pedidos...
              </Typography>
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
