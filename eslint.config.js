import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

/**
 * Запрет inline-CSS (ADR 005). Делается правилом ядра, а не `react/forbid-dom-props`:
 * `eslint-plugin-react` не поддерживает ESLint 10 и вообще не нужен, а этот селектор
 * ловит проп `style` и на DOM-элементах, и на компонентах.
 */
const noInlineStyle = {
  selector: "JSXAttribute[name.name='style']",
  message: 'Инлайн-CSS запрещён (ADR 005): стилизуем через styled-components и токены темы.',
};

/** Направление импортов внутри клиента: app → features → entities → shared. */
const layers = [
  { dir: 'shared', forbidden: ['@/app/*', '@/entities/*', '@/features/*'] },
  { dir: 'entities', forbidden: ['@/app/*', '@/features/*'] },
  // Фичи не ходят друг в друга напрямую: общее — через entities и shared.
  { dir: 'features', forbidden: ['@/app/*', '@/features/*'] },
];

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'] },

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    // Порядок импортов был «договорённостью», которую никто не проверял, и он разъезжался.
    // Теперь это правило с автопочинкой: внешние → @/… → относительные.
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: [['^\\u0000'], ['^node:', '^@?\\w'], ['^@org/'], ['^@/'], ['^\\.']],
        },
      ],
      'simple-import-sort/exports': 'error',
      // Типы проверяет TypeScript; в TS-файлах правило только шумит на DOM/Node-глобалях.
      'no-undef': 'off',
      'no-restricted-syntax': ['error', noInlineStyle],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        // disallowTypeAnnotations: import()-типы нужны в vi.mock(..., importOriginal)
        { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },

  {
    files: ['apps/client/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  ...layers.map(({ dir, forbidden }) => ({
    files: [`apps/client/src/${dir}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: forbidden,
              message: `Слой ${dir} не импортирует отсюда (CLAUDE.md: app → features → entities → shared).`,
            },
          ],
        },
      ],
    },
  })),

  {
    files: ['**/*.test.{ts,tsx}', 'apps/client/test/**', 'scripts/**', '*.config.{ts,js}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },

  {
    // Сборочные скрипты — обычный JS вне TS-проекта: типизированные правила к ним неприменимы.
    files: ['**/*.mjs', 'eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
