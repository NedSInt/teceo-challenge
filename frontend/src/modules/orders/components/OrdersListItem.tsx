import { memo, useMemo } from 'react';
import {
  Box,
  Checkbox,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import useMoney from '../../../hooks/useMoney';
import theme from '../../../theme/theme';
import type { OrderStatus } from '../enums/orderStatus.enum';
import { OrderDTO } from '../interfaces/order.dto';
import { orderStatusMapper } from '../utils/orderStatus.mapper';
import OrderStatusDot from './OrderStatusDot';
import { coolToggledAnimation } from './orderListItem.styles';

const cellSx = {
  px: 1.5,
  py: 0.75,
  borderBottom: 1,
  borderColor: 'divider',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  fontSize: '0.875rem',
  fontWeight: 400,
  WebkitFontSmoothing: 'subpixel-antialiased',
};

interface OrdersListItemProps {
  order: OrderDTO;
  onChangeStatus: (newStatus: OrderStatus, orderId: string) => void;
  onToggle: (orderId: string) => void;
  isToggled: boolean;
  gridTemplateColumns: string;
  rowSx?: Record<string, unknown>;
}

const OrdersListItem = memo(({
  order,
  onChangeStatus,
  onToggle,
  isToggled,
  gridTemplateColumns,
  rowSx,
}: OrdersListItemProps) => {
  const { format } = useMoney();
  const item = useMemo(
    () => OrderDTO.toListItem(order),
    [
      order.id,
      order.status,
      order.code,
      order.customer?.name,
      order.customer?.email,
      order.totalProductColors,
      order.totalQuantity,
      order.totalValue,
      order.averageValuePerUnit,
      order.averageValuePerProductColor,
    ],
  );
  const orderId = order.id;

  return (
    <Box
      component="div"
      role="row"
      sx={{
        backgroundColor: isToggled
          ? `${theme.palette.primary.main}15`
          : 'inherit',
        gridTemplateColumns,
        WebkitFontSmoothing: 'subpixel-antialiased',
        ...rowSx,
      }}
    >
      <Box component="div" role="cell" sx={{ ...cellSx, justifyContent: 'flex-start' }}>
        <Checkbox
          size="small"
          checked={isToggled}
          onChange={() => onToggle(orderId)}
        />
      </Box>
      <Box component="div" role="cell" sx={cellSx}>
        <Typography variant="body2">{item.customerName}</Typography>
      </Box>
      <Box component="div" role="cell" sx={cellSx}>
        <Typography variant="body2">{item.customerEmail}</Typography>
      </Box>
      <Box component="div" role="cell" sx={{ ...cellSx, justifyContent: 'flex-end' }}>
        <Typography variant="body2">{item.totalProductColors}</Typography>
      </Box>
      <Box component="div" role="cell" sx={{ ...cellSx, justifyContent: 'flex-end' }}>
        <Typography variant="body2">{item.totalQuantity}</Typography>
      </Box>
      <Box component="div" role="cell" sx={{ ...cellSx, justifyContent: 'flex-end' }}>
        <Typography variant="body2">{format(item.totalValue)}</Typography>
      </Box>
      <Box component="div" role="cell" sx={{ ...cellSx, justifyContent: 'flex-end' }}>
        <Typography variant="body2">
          {format(item.averageValuePerProductColor)}
        </Typography>
      </Box>
      <Box component="div" role="cell" sx={{ ...cellSx, justifyContent: 'flex-end' }}>
        <Typography variant="body2">
          {format(item.averageValuePerUnit)}
        </Typography>
      </Box>
      <Box component="div" role="cell" sx={cellSx}>
        <Select
          disableUnderline
          variant="filled"
          size="small"
          value={item.status}
          onChange={(e) => onChangeStatus(e.target.value, orderId)}
          MenuProps={{
            PaperProps: {
              sx: { ...(isToggled && coolToggledAnimation) },
            },
          }}
          sx={{
            ...(isToggled && coolToggledAnimation),
            borderRadius: '4px',
            minWidth: 0,
            width: '100%',
            '& .MuiSelect-select': {
              display: 'flex',
              alignItems: 'center',
              paddingY: 0.5,
            },
          }}
        >
          {Object.entries(orderStatusMapper).map(([status, { label }]) => (
            <MenuItem key={status} value={status}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <OrderStatusDot status={status as OrderStatus} />
                <Typography variant="body2">{label}</Typography>
              </Stack>
            </MenuItem>
          ))}
        </Select>
      </Box>
    </Box>
  );
});

OrdersListItem.displayName = 'OrdersListItem';

export default OrdersListItem;
