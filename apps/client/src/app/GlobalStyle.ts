import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    height: 100%;
  }

  body {
    margin: 0;
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.font.family};
    font-size: ${({ theme }) => theme.font.size.md};
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
  }

  /* Страница не скроллится — скроллятся панели (макет). */
  body {
    overflow: hidden;
  }

  h1, h2, h3, p, ul, ol {
    margin: 0;
  }

  ul, ol {
    padding: 0;
    list-style: none;
  }

  button {
    font: inherit;
    color: inherit;
  }

  :focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focus};
    outline-offset: 1px;
  }
`;
