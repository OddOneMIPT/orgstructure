import type { OrgNode } from '@org/contracts';

/**
 * Сид детерминированный: свой PRNG вместо Math.random и фиксированная базовая метка времени
 * вместо new Date(). Иначе каждый запуск сервера давал бы другие данные и ломал бы
 * серверные тесты, скриншоты и любое сравнение «тот же сид — то же дерево».
 */

const SEED = 20260918;
const BASE_TIME = Date.parse('2026-09-18T09:00:00.000Z');

/** mulberry32 — короткий и равномерный; криптостойкость здесь не нужна. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIVISIONS = ['Технологии', 'Коммерция', 'Операции', 'Корпоративные функции'] as const;

const DEPARTMENTS: Record<(typeof DIVISIONS)[number], readonly string[]> = {
  Технологии: [
    'Разработка продукта',
    'Инфраструктура',
    'Данные и аналитика',
    'Информационная безопасность',
  ],
  Коммерция: ['Прямые продажи', 'Партнёрская сеть', 'Маркетинг', 'Клиентский сервис'],
  Операции: ['Логистика', 'Закупки', 'Производство', 'Качество'],
  'Корпоративные функции': ['Финансы', 'Персонал', 'Юридическая служба', 'Административная служба'],
};

const TEAMS: Record<string, readonly string[]> = {
  'Разработка продукта': ['Платформа', 'Мобильные приложения', 'Веб-интерфейсы', 'Интеграции'],
  Инфраструктура: ['Облако', 'Сети', 'Надёжность', 'Инструменты разработки'],
  'Данные и аналитика': ['Хранилище', 'Отчётность', 'Машинное обучение', 'Качество данных'],
  'Информационная безопасность': ['Мониторинг', 'Комплаенс', 'Защита приложений'],
  'Прямые продажи': ['Крупные клиенты', 'Средний бизнес', 'Малый бизнес', 'Государственный сектор'],
  'Партнёрская сеть': ['Реселлеры', 'Технологические альянсы', 'Развитие канала'],
  Маркетинг: ['Бренд', 'Digital', 'Продуктовый маркетинг', 'Мероприятия'],
  'Клиентский сервис': ['Первая линия', 'Вторая линия', 'Обучение клиентов'],
  Логистика: ['Склады', 'Транспорт', 'Планирование поставок'],
  Закупки: ['Прямые закупки', 'Непрямые закупки', 'Работа с поставщиками'],
  Производство: ['Сборка', 'Наладка', 'Планирование выпуска', 'Ремонт'],
  Качество: ['Входной контроль', 'Выходной контроль', 'Сертификация'],
  Финансы: ['Бухгалтерия', 'Казначейство', 'Планирование и анализ', 'Налоги'],
  Персонал: ['Подбор', 'Развитие', 'Компенсации и льготы'],
  'Юридическая служба': ['Договорная работа', 'Корпоративное право', 'Судебная практика'],
  'Административная служба': ['Офисы', 'Документооборот', 'Внутренние сервисы'],
};

const between = (random: () => number, min: number, max: number): number =>
  min + Math.floor(random() * (max - min + 1));

/**
 * Дерево: 4 дивизиона → 3–4 отдела → 2–4 команды.
 * Собственный `headcount` узла — это его управленческий слой: у команд он основной,
 * у отделов и дивизионов меньше, но не ноль, поэтому взвешенное среднее осмысленно на всех уровнях.
 */
export function createSeedNodes(): OrgNode[] {
  const random = createRandom(SEED);
  const nodes: OrgNode[] = [];
  let minuteOffset = 0;

  const push = (node: Omit<OrgNode, 'updatedAt'>): void => {
    minuteOffset += between(random, 3, 90);
    nodes.push({
      ...node,
      updatedAt: new Date(BASE_TIME + minuteOffset * 60_000).toISOString(),
    });
  };

  DIVISIONS.forEach((divisionName, divisionIndex) => {
    const divisionId = `div-${divisionIndex + 1}`;
    push({
      id: divisionId,
      name: divisionName,
      parentId: null,
      headcount: between(random, 3, 8),
      budget: between(random, 8, 20) * 1_000_000,
      performance: between(random, 55, 92),
    });

    const departmentNames = DEPARTMENTS[divisionName].slice(0, between(random, 3, 4));

    departmentNames.forEach((departmentName, departmentIndex) => {
      const departmentId = `dep-${divisionIndex + 1}-${departmentIndex + 1}`;
      push({
        id: departmentId,
        name: departmentName,
        parentId: divisionId,
        headcount: between(random, 2, 6),
        budget: between(random, 3, 12) * 1_000_000,
        performance: between(random, 45, 95),
      });

      const available = TEAMS[departmentName] ?? [];
      const teamNames = available.slice(0, Math.min(available.length, between(random, 2, 4)));

      teamNames.forEach((teamName, teamIndex) => {
        push({
          id: `team-${divisionIndex + 1}-${departmentIndex + 1}-${teamIndex + 1}`,
          name: teamName,
          parentId: departmentId,
          headcount: between(random, 4, 19),
          budget: between(random, 2, 9) * 1_000_000,
          performance: between(random, 30, 99),
        });
      });
    });
  });

  return nodes;
}
