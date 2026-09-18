# ADR 001. Стек и структура репозитория

Статус: Принято · 2026-09-18

## Контекст

Тестовое задание: дашборд орг-структуры с деревом, таблицей агрегатов, live-обновлениями, Docker/Nginx и
AI-поиском. Обязательны React, Vite, TypeScript; плюс — styled-components; запрещены UI-библиотеки.
Нужен собственный mock-сервер (HTTP + realtime). Жёсткое ограничение — прод-сборка клиента ≤ 200 КБ gzip.
Срок 2–3 дня, поэтому инфраструктура должна быть минимальной, но контракт клиент↔сервер — надёжным.

## Решение

**Монорепозиторий на npm workspaces:**

- `apps/client` — **React 19** + Vite + TypeScript, styled-components 6.5.x, @tanstack/react-query 5, zod 4,
  lucide-react (только именованные импорты). Мажор React зафиксирован: от него зависят нативный булев проп
  `inert` (ADR 005) и требование styled-components ≥ 6.1.13.
- `apps/server` — Node 22, Fastify + @fastify/websocket (`ws`), zod. Dev — `tsx watch`, prod — один файл,
  собранный esbuild (контракты вбандлены, в Docker-образе нет ни исходников, ни dev-зависимостей).
- `packages/contracts` — zod-схемы и выведенные типы: `OrgNode`, сообщения WebSocket, `SearchFilter`.
  Source-only пакет, без собственного шага сборки: Vite, tsx и esbuild потребляют TS напрямую.
  `exports` = `{ ".": { "types": "./src/index.ts", "default": "./src/index.ts" } }`, `"type": "module"`.
  Это резолвится **только** при `moduleResolution: "bundler"` — при `node16`/`nodenext` `tsc` ищет для цели
  из `exports` объявления как для JS-пути и падает. Поэтому `bundler` во всех трёх пакетах плюс `paths`
  (`@org/contracts` → `packages/contracts/src/index.ts`) как подстраховка для инструментов, игнорирующих
  `exports`. Каталог `packages/contracts/src` обязан попадать в TS-проект линтера (`projectService: true`),
  иначе типизированные правила ругаются «file not included in project».

**Клиент — слои** `app → features → entities → shared` (FSD-lite), абсолютные импорты `@/`.
Доменная логика (модель дерева, агрегация, патчи) — чистый TS в `entities/org`, без React.

**UI-состояние** — собственный мини-стор (~30 строк) на `useSyncExternalStore` с селекторами.
**Серверное состояние** — только react-query.

**Инструменты:** Vitest (через `test.projects`: клиент — `jsdom` + `test/setup.ts`, сервер и контракты —
`node`), ESLint flat (typescript-eslint + eslint-plugin-react-hooks; запрет `style` — правилом ядра
`no-restricted-syntax`), Prettier, скрипт `size` (сумма gzip JS+CSS из `dist/assets`, падает при > 200 КБ) —
с первого шага, а не в конце.

**Версии пиним явно, «последнее» не ставим.** Проверено по реестру 2026-09-18:

| Пакет | Ставим | Почему не latest |
| --- | --- | --- |
| TypeScript | **5.9.3** | `latest` = 7.0.2 (Go-компилятор), а `typescript-eslint@8.70` требует `>=4.8.4 <6.1.0` — типизированный линтинг просто не заведётся |
| ESLint | **9.39.x** | `latest` = 10.x; `eslint-plugin-react@7.37.5` заявляет `^9.7` |
| eslint-plugin-react | **не используем** | нужен был только ради `react/forbid-dom-props`; тот же запрет закрывается ядром: `no-restricted-syntax` с селектором `JSXAttribute[name.name='style']` — и он ловит не только DOM-элементы, но и компоненты |
| styled-components | **6.5.x** | ≥ 6.1.13 из-за совместимости с React 19 |
| @fastify/websocket | **11.x** | сигнатура обработчика менялась между мажорами: v8–v9 — `(connection, req)` с `connection.socket`, v10+ — `(socket, req)` |

Остальное — актуальные стабильные на момент scaffold, всё фиксируется `package-lock.json`.

## Альтернативы

- **Один пакет, сервер в папке `server/`** — проще, но типы контракта пришлось бы дублировать или
  импортировать через относительные пути между «приложениями»; в Docker тянулись бы лишние зависимости.
- **pnpm / turborepo** — быстрее и строже, но для трёх пакетов не окупается; npm есть везде, Dockerfile проще.
- **Express / голый `node:http`** — Express без типизированной схемы и с отдельной интеграцией ws;
  голый http — лишний ручной код (роутинг, ETag, CORS). Fastify даёт это из коробки и остаётся лёгким.
- **json-server / MSW вместо сервера** — не закрывают WebSocket, Docker-сценарий и AI-прокси.
- **Zustand / Redux для UI-состояния** — задача покрывается `useSyncExternalStore`; лишняя зависимость
  против бюджета бандла и без выигрыша.
- **SWR вместо react-query** — нет удобного `setQueryData`-сценария с точечными патчами и devtools.
- **`zod/mini`** — меньше по размеру, но менее удобный API; остаётся запасным вариантом, если упрёмся в бюджет.

## Последствия

- Один источник правды по контракту: сервер валидирует исходящие данные теми же схемами, какими клиент — входящие.
- Клиентский бандл включает zod и styled-components (~30 КБ gzip суммарно) — контролируется `npm run size`.
- Прод-сборка сервера требует esbuild-шага (`build` обязан что-то эмитить, `tsc --noEmit` — это только
  typecheck). Внешние зависимости перечисляются **явно**: обычный `--packages=external` вынес бы и
  `@org/contracts`, тогда Node в контейнере попытался бы импортировать `.ts` и упал на старте. В `build`
  добавляется smoke-проверка `node dist/index.js`.
- Правило направлений импорта держится на ревью и на ESLint `no-restricted-imports`.
