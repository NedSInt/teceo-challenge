import {
  CircularProgress,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import { ProductColorDTO } from '../interfaces/product-color.dto';
import HomeProductColorListItem from './HomeProductColorListItem';
import useHomeProductColorList from './hooks/useHomeProductColorList';

const HomeProductColorList = () => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useHomeProductColorList();

  const loaderRef = useInfiniteScroll(fetchNextPage, !!hasNextPage, isFetchingNextPage);

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
    return <p>error</p>;
  }

  const productColors = data.pages.flatMap((p) => p.data);
  const totalCount = data.pages[data.pages.length - 1]?.count ?? 0;

  return (
    <>
      <Grid container spacing={2}>
        {productColors.map((productColor) => (
          <Grid size={{ xs: 6, sm: 4, md: 3 }} key={productColor.id}>
            <HomeProductColorListItem item={ProductColorDTO.toCardItem(productColor)} />
          </Grid>
        ))}
      </Grid>

      <div ref={loaderRef} style={{ height: 10 }} />

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
    </>
  );
};

export default HomeProductColorList;
