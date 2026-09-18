# Бюджетница — правила репозитория

Дашборд мониторинга орг-структуры (дивизионы → отделы → команды): интерактивное дерево + аналитическая
таблица с агрегатами, live-обновления по WebSocket, AI-поиск. Тестовое задание.

- Задание: `task/task.md`, макет: `task/design.drawio.xml`, схема деплоя: `task/archtecture.drawio.xml`
- План по шагам: `docs/plan.md` — **источник правды о том, что и в каком порядке делаем**
- Принятые решения: `docs/adr/` — прежде чем менять что-то из зафиксированного там, обнови/замени ADR

## Стек (зафиксирован, ADR 001)

| Слой | Технологии |
| --- | --- |
| Клиент | React 19, Vite, **TypeScript 5.9.x**, styled-components 6.5.x, @tanstack/react-query 5, zod 4, lucide-react (только именованные импорты иконок) |
| Сервер | Node 22, Fastify, `ws` (через @fastify/websocket), zod, tsx (dev), esbuild-бандл (prod) |
| Контракт | `packages/contracts` — zod-схемы и типы, общие для клиента и сервера |
| Тесты | Vitest, @testing-library/react (точечно) |
| Качество | **ESLint 9.39.x** (flat, typescript-eslint 8, eslint-plugin-react-hooks 7), Prettier, `npm run size` (бюджет бандла) |
| Прод | Docker Compose, Nginx (статика + gzip, прокси `/api` и `/ws`) |

Запрещено: UI-библиотеки и дизайн-системы (MUI, Ant, Radix-themes, Tailwind и т.п.), стейт-менеджеры
(Redux, MobX, Zustand), axios, lodash, moment/date-fns, готовые tree/table/virtual-компоненты.
Новая runtime-зависимость клиента = запись в ADR (бюджет прод-сборки ≤ 200 КБ gzip).

**Версии пиним, «последнее» не ставим** (ADR 001): `typescript@latest` — это 7.x, который
`typescript-eslint` ещё не поддерживает (`>=4.8.4 <6.1.0`); `eslint@latest` — 10.x, который не поддерживает
`eslint-plugin-react`. Поэтому TypeScript 5.9.x и ESLint 9.39.x, а `eslint-plugin-react` не используется
вовсе.

## Структура

```
apps/client/src
  app/        # провайдеры, layout, шапка, глобальные стили, тема
  features/   # org-tree, org-table, search, connection — UI + хуки фичи
  entities/   # org: модель, агрегация, патчи — чистый TS без React
  shared/     # api, ui (кнопка, тултип, состояния), lib (debounce, backoff, format), config
apps/server/src          # http, ws, store (in-memory), seed, ticker, ai-search
packages/contracts/src   # OrgNode, WS-сообщения, SearchFilter
docs/                    # architecture.md, data-model.md, adr/, plan.md, ai-log.md, screenshots/
```

Направление импортов: `app → features → entities → shared`; в обратную сторону и между фичами напрямую —
нельзя (общение фич через `entities` и ui-store). Абсолютные импорты `@/…` внутри клиента; относительные —
только внутри одной папки-модуля. Контракты импортируются как `@org/contracts`.

## Процесс

- **Ветки цепочкой**: `main → step/0-conventions → step/1-foundation → step/2-core → step/3-polish → step/4-bonus`.
  Каждая следующая ветка создаётся от предыдущей. Claude не мерджит в `main`, не пушит и не ставит теги
  `step/N` — автор полирует ветку, мерджит и тегирует сам.
- Внутри ветки — небольшие атомарные коммиты, Conventional Commits на английском
  (`feat(tree): …`, `fix(ws): …`, `docs(adr): …`, `test(org): …`, `chore: …`).
- Перед каждым коммитом зелёные: `npm run typecheck`, `npm run lint`, `npm test`. Перед закрытием шага —
  ещё `npm run build && npm run size`.
- **`docs/ai-log.md`**: одна строка на задачу — что сгенерировано AI, что переписано руками и почему.
  Это сырьё для обязательного раздела README «AI в разработке»; вести честно и сразу, не задним числом.
- Нетривиальное решение → `docs/adr/NNN-название.md` (контекст, решение, альтернативы, последствия).
- Документация и UI — на русском; код, идентификаторы, комментарии, коммиты — на английском.
- Шаг закрыт, когда выполнен его чек-лист приёмки в `docs/plan.md` и обновлены docs/README.

## Правила кода

**TypeScript.** `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`. Без `any`, без `as` кроме
`as const` и сужений после проверки; без `enum` (union-литералы); без default-экспортов (кроме конфигов).
Типы данных выводятся из zod-схем (`z.infer`), руками не дублируются.

**Данные (ADR 002–004).**
- Любой вход извне (HTTP-ответ, WS-сообщение, ответ AI) проходит zod-валидацию; невалидное = ошибка/игнор
  с логом, но не «как-нибудь отрисуем».
- Сеть — только через `shared/api`; в `queryFn` всегда пробрасывается `signal`. `staleTime: 5_000`.
- В кэше react-query лежит готовая `OrgModel` (индексы + агрегаты); `structuralSharing: false` задаётся в
  `defaultOptions.queries` (не в `useQuery` — патч может прийти до монтирования). Идентичность сохраняем
  сами: `buildModel(nodes, revision, prev)` и `applyPatch(model, patch)` переиспользуют нетронутые объекты.
- WS-патч применяется через `setQueryData` без рефетча, причём результат `applyPatch` проверяется **до**
  записи: `null` означает «нужен рефетч», а не значение для кэша. Рефетч (`invalidateQueries`) — только при
  смене эпохи сервера, разрыве версий или `reset`.
- Агрегаты: полный расчёт один раз при построении модели, дальше — дельта вверх по предкам, O(глубина).
  Компоненты агрегаты не считают, только читают.
- Всё в `entities/` — чистые функции без React и без побочных эффектов, покрыты unit-тестами.

**UI и стили (ADR 005).**
- Только styled-components. Никакого inline-CSS: проп `style` запрещён линтером — правилом ядра
  `no-restricted-syntax` с селектором `JSXAttribute[name.name='style']` (ловит и DOM-элементы, и компоненты,
  не требует `eslint-plugin-react`). Динамика — через transient-пропсы (`$tone`) с конечным набором значений
  или через `data-*`/`aria-*` селекторы. Единственное исключение для непрерывного значения — `$pct`
  (целое 0–100) у `PerformanceBar`, см. ADR 005.
- Цвета, отступы, радиусы, тайминги — только из темы (`app/theme`), без литералов в компонентах.
- Анимации — CSS (transition/keyframes); высота дерева — `grid-template-rows: 0fr ↔ 1fr`.
  Любая анимация гасится под `prefers-reduced-motion: reduce`.
- UI-состояние (expanded, selected, view, sort, filter) — в крошечном ui-store на
  `useSyncExternalStore` с селекторами; серверные данные в нём не дублируются.
- `memo` — только вместе со стабильными пропсами (примитивы/стабильные ссылки), иначе не ставим.

**Доступность.** Дерево — WAI-ARIA `tree/treeitem/group` с roving tabindex; таблица — нативный `<table>`,
`aria-sort`, навигация стрелками/Home/End/Enter; декоративные иконки `aria-hidden`; индикатор соединения —
`role="status"`; цвет performance всегда дублируется числом.

**Сервер.** Состояние — in-memory `OrgStore` с ревизией `{ epoch, version }` (`epoch` — id запуска
процесса, `version` монотонна только внутри эпохи); наружу отдаются только копии/снимки
(`snapshot(): { nodes, epoch, version }`), внутренние массивы не утекают. Конфиг — из env через zod с понятной
ошибкой. Секреты (ключ AI) живут только на сервере.

**Тесты.** Обязательно: агрегация, `applyPatch` (инкремент == полный пересчёт), целостность дерева
(дубликаты id, сироты, циклы), backoff, форматирование бюджета, парсер/применение поискового фильтра.
Компонентные тесты — только на поведение (сортировка, клавиатура), без снапшотов. Vitest настроен через
`test.projects`: клиент — `jsdom` + `test/setup.ts` (заглушки `matchMedia`, `scrollIntoView`), сервер и
контракты — `node`. Ни один тест не ждёт `transitionend`/`animationend`: jsdom их не шлёт.

## Окружение

- Node 22 (`.nvmrc`). Если в шелле другая версия:
  `export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"`.
- Пакетный менеджер — npm workspaces. Команды из корня (появятся на шаге 1):
  `npm run dev` · `npm test` · `npm run lint` · `npm run typecheck` · `npm run build` · `npm run size`.
