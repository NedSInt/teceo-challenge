import { memo, useMemo } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  IconButton,
  Typography,
} from '@mui/material';
import useMoney from '../../../hooks/useMoney';
import theme from '../../../theme/theme';
import { ProductColorDTO } from '../interfaces/product-color.dto';

interface HomeProductColorListItemProps {
  productColor: ProductColorDTO;
}

const HomeProductColorListItem = memo(({ productColor }: HomeProductColorListItemProps) => {
  const { format } = useMoney();
  const item = useMemo(
    () => ProductColorDTO.toCardItem(productColor),
    [
      productColor.id,
      productColor.price,
      productColor.product?.imageUrl,
      productColor.product?.name,
      productColor.color?.name,
    ],
  );

  return (
    <Card variant="outlined" sx={{ borderRadius: '8px' }}>
      <CardMedia sx={{ height: 250 }} image={item.imageUrl} />
      <CardContent>
        <Typography component="div">{item.title}</Typography>
        <Typography color="textSecondary">{item.subTitle}</Typography>
      </CardContent>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        padding={2}
        paddingTop={0}
        gap={2}
      >
        <Typography>{format(item.price)}</Typography>
        <IconButton
          size="small"
          sx={{ border: `1px solid ${theme.palette.divider}` }}
        >
          <AddRoundedIcon />
        </IconButton>
      </Box>
    </Card>
  );
});

HomeProductColorListItem.displayName = 'HomeProductColorListItem';

export default HomeProductColorListItem;
