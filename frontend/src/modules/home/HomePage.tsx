import { Box, Container, Stack, Typography } from '@mui/material';
import { useLayoutEffect } from 'react';
import { TCO_BANNER } from '../../constants/images.constants';
import theme from '../../theme/theme';
import HomeProductColorList from './components/HomeProductColorList';

const HomePage = () => {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Stack spacing={3} justifyContent="center" alignItems="center">
      <img
        style={{
          width: '100%',
          height: '370px',
          objectFit: 'cover',
          objectPosition: 'bottom',
        }}
        src={TCO_BANNER}
      />
      <Container maxWidth="lg">
        <Stack spacing={2}>
          <div>
            <Typography
              variant="h6"
              color="textPrimary"
              gutterBottom
              textAlign="center"
            >
              DESTAQUES E NOVIDADES
            </Typography>
            <div
              style={{
                width: 70,
                height: 2,
                color: 'black',
                backgroundColor: theme.palette.primary.main,
                margin: '0 auto',
                borderRadius: theme.shape.borderRadius,
              }}
            />
          </div>

          <Box paddingX={3} paddingBottom={2}>
            <HomeProductColorList />
          </Box>
        </Stack>
      </Container>
    </Stack>
  );
};

export default HomePage;
