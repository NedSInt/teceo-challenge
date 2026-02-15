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
import { useEffect, useMemo, useRef, useState } from 'react';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import { ProductColorDTO } from '../interfaces/product-color.dto';
import HomeProductColorListItem from './HomeProductColorListItem';
import useHomeProductColorList from './hooks/useHomeProductColorList';

const COLS = 4;
const ROW_HEIGHT_ESTIMATE = 320;
const OVERSCAN = 6;

const HomeProductColorList = () => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, status } =
    useHomeProductColorList();

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

  const productColors = data?.pages?.flatMap((p) => p.data) ?? [];
  const totalCount = data?.pages?.[data.pages.length - 1]?.count ?? 0;

  const rows = useMemo(() => {
    const list: (typeof productColors)[] = [];
    for (let i = 0; i < productColors.length; i += COLS) {
      list.push(productColors.slice(i, i + COLS));
    }
    return list;
  }, [productColors]);

  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: OVERSCAN,
    scrollMargin,
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
              }}
            >
              <Grid container spacing={2} sx={{ height: '100%' }}>
                {rowItems.map((productColor) => (
                  <Grid size={{ xs: 6, sm: 4, md: 3 }} key={productColor.id}>
                    <HomeProductColorListItem
                      item={ProductColorDTO.toCardItem(productColor)}
                    />
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
