import type { AppTheme } from './tokens';

declare module 'styled-components' {
  // Тема типизирована целиком: обращение к несуществующему токену — ошибка компиляции.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends AppTheme {}
}
