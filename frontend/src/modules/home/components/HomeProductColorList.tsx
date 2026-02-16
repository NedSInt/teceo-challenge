import { useWindowVirtualizer } from '@tanstack/react-virtual';
import {
  Alert,
  Button,
  CircularProgress,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useLayoutEffect, useMemo, useRef } from 'react';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import HomeProductColorListItem from './HomeProductColorListItem';
import useHomeProductColorList from './hooks/useHomeProductColorList';

const COLS = 4;
const ROW_HEIGHT_ESTIMATE = 320;
const ROW_GAP = 76;
const OVERSCAN = 6;

const HomeProductColorList = () => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, status } =
    useHomeProductColorList();

  const parentRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  useLayoutEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      window.scrollTo(0, 0);
    }
  }, []);

  const loaderRef = useInfiniteScroll(fetchNextPage, !!hasNextPage, isFetchingNextPage);

  const productColors = data?.pages?.flatMap((p) => p.data) ?? [];
  const totalCount = data?.pages?.[data.pages.length - 1]?.count ?? 0;

  const rows = useMemo(() => {
    const flat = data?.pages?.flatMap((p) => p.data) ?? [];
    const list: (typeof flat)[] = [];
    for (let i = 0; i < flat.length; i += COLS) {
      list.push(flat.slice(i, i + COLS));
    }
    return list;
  }, [data?.pages]);

  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_HEIGHT_ESTIMATE + ROW_GAP,
    overscan: OVERSCAN,
    scrollMargin: 0,
    initialOffset: 0,
    getItemKey: (index) => rows[index]?.[0]?.id ?? index,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  if (status === 'pending') {
    return (
      <Grid container spacing={2}>
        {new Array(8).fill(1).map((_, index: number) => (
          <Grid size={{ xs: 6, sm: 4, md: 3 }} key={index}>
            <Skeleton variant="rounded" width="100%" height={300} />
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
        Não foi possível carregar o catálogo. Verifique sua conexão e tente
        novamente.
      </Alert>
    );
  }

  return (
    <div ref={parentRef}>
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualRows.map((virtualRow) => {
          const rowItems = rows[virtualRow.index] ?? [];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
                willChange: 'transform',
                paddingBottom: ROW_GAP,
                boxSizing: 'border-box',
              }}
            >
              <Grid container spacing={2} sx={{ height: '100%' }}>
                {rowItems.map((productColor) => (
                  <Grid size={{ xs: 6, sm: 4, md: 3 }} key={productColor.id}>
                    <HomeProductColorListItem productColor={productColor} />
                  </Grid>
                ))}
              </Grid>
            </div>
          );
        })}
      </div>

      <div ref={loaderRef} style={{ height: 10 }} aria-hidden />

      {totalCount > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {productColors.length} de {totalCount} produtos
        </Typography>
      )}

      {isFetchingNextPage && (
        <Stack alignItems="center" padding={2}>
          <CircularProgress size="24px" />
        </Stack>
      )}
    </div>
  );
};

export default HomeProductColorList;
