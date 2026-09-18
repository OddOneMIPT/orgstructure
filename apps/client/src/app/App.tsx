import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import styled, { ThemeProvider } from 'styled-components';

import { SearchField } from '@/features/search';
import { useMediaQuery } from '@/shared/lib/useMediaQuery';
import { theme } from '@/shared/config/theme';

import { GlobalStyle } from './GlobalStyle';
import { OrgDashboard } from './OrgDashboard';
import { ViewSwitch } from './ViewSwitch';
import { createQueryClient } from './queryClient';

const Layout = styled.div`
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  gap: ${({ theme: t }) => t.spacing.lg};
  height: ${({ theme: t }) => t.layout.headerHeight};
  padding-inline: ${({ theme: t }) => t.spacing.xl};
  background: ${({ theme: t }) => t.colors.surface};
  border-bottom: 1px solid ${({ theme: t }) => t.colors.border};
`;

const Brand = styled.h1`
  font-size: ${({ theme: t }) => t.font.size.xl};
  font-weight: ${({ theme: t }) => t.font.weight.semibold};
  white-space: nowrap;
`;

/** Поиск прижат вправо, как в макете. */
const Spacer = styled.div`
  flex: 1;
`;

const Main = styled.main`
  min-height: 0;
  padding: ${({ theme: t }) => t.spacing.xl};
`;

export function App() {
  // Клиент создаётся один раз на жизнь приложения, а не на каждый рендер.
  const [queryClient] = useState(createQueryClient);
  const isSplit = useMediaQuery(`(min-width: ${theme.layout.split})`);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <Layout>
          <Header>
            <Brand>Бюджетница</Brand>
            {isSplit ? null : <ViewSwitch />}
            <Spacer />
            <SearchField />
          </Header>
          <Main>
            <OrgDashboard />
          </Main>
        </Layout>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
