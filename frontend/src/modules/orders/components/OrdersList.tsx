import { useVirtualizer } from '@tanstack/react-virtual';
import {
  CircularProgress,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useCallback, useMemo, useRef } from 'react';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useOrdersList from '../hooks/useOrdersList';
import { OrderDTO } from '../interfaces/order.dto';
import OrdersListItem from './OrdersListItem';

const ROW_HEIGHT = 53;
const TABLE_MAX_HEIGHT = 600;

const OrdersList = () => {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    onChangeStatus,
    toggleOrderId,
    selectedOrderIds,
  } = useOrdersList();

  const orders = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? ([] as OrderDTO[]),
    [data?.pages]
  );
  const totalCount = data?.pages[data.pages.length - 1]?.count ?? 0;

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const loaderRef = useInfiniteScroll(
    fetchNextPage,
    !!hasNextPage,
    isFetchingNextPage
  );

  const rowVirtualizer = useVirtualizer({
    count: orders.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const handleTableScroll = useCallback(() => {
    const el = tableContainerRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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
    return <p>error</p>;
  }

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <>
      {totalCount > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {orders.length} de {totalCount} pedidos
        </Typography>
      )}
      <TableContainer
        ref={tableContainerRef}
        component={Paper}
        variant="outlined"
        onScroll={handleTableScroll}
        sx={{ maxHeight: TABLE_MAX_HEIGHT, overflow: 'auto' }}
      >
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
                  }}
                />
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <div ref={loaderRef} style={{ height: 1 }} />

      {isFetchingNextPage && (
        <Stack alignItems="center" padding={2} paddingTop={1}>
          <CircularProgress size="24px" />
        </Stack>
      )}
    </>
  );
};

export default OrdersList;
