import styled from 'styled-components';

/** Карточка-панель со своим скроллом внутри: страница не скроллится (макет). */
export const Panel = styled.section`
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
  height: 100%;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  box-shadow: ${({ theme }) => theme.shadow.panel};
  overflow: hidden;
`;
