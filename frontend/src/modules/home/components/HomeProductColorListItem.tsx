import { memo } from 'react';
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
import type { CardItem } from '../interfaces/home-product-color-list-item.interface';

interface HomeProductColorListItemProps {
  item: CardItem;
}

const HomeProductColorListItem = memo(({ item }: HomeProductColorListItemProps) => {
  const { format } = useMoney();

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
