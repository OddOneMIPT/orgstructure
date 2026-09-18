import type { OrgLevel, SearchFilter } from '@org/contracts';

import { createNamePredicate, type NodePredicate } from './filter';
import type { OrgModel, OrgNode } from './types';

const LEVEL_BY_DEPTH: readonly OrgLevel[] = ['division', 'department', 'team'];

const inRange = (
  value: number | null,
  range: { min: number | null; max: number | null },
): boolean => {
  if (value === null) return false;
  if (range.min !== null && value < range.min) return false;
  if (range.max !== null && value > range.max) return false;
  return true;
};

/**
 * Предикат из структурированного фильтра (ADR 007).
 *
 * Пороговые условия сравниваются с **агрегатами**: именно эти числа пользователь
 * видит в строке таблицы, и «отделы с бюджетом больше 50 млн» он понимает как
 * суммарный бюджет подразделения, а не собственный.
 */
export function createFilterPredicate(filter: SearchFilter): NodePredicate | null {
  const byName = filter.name === null ? null : createNamePredicate(filter.name);

  const checks: ((node: OrgNode, model: OrgModel) => boolean)[] = [];

  if (byName) checks.push(byName);

  if (filter.levels !== null && filter.levels.length > 0) {
    const levels = new Set(filter.levels);
    checks.push((node, model) => {
      const depth = model.depthOf.get(node.id);
      const level = depth === undefined ? undefined : LEVEL_BY_DEPTH[depth];
      return level !== undefined && levels.has(level);
    });
  }

  if (filter.headcount) {
    const range = filter.headcount;
    checks.push((node, model) => inRange(model.aggregates.get(node.id)?.headcount ?? null, range));
  }

  if (filter.budget) {
    const range = filter.budget;
    checks.push((node, model) => inRange(model.aggregates.get(node.id)?.budget ?? null, range));
  }

  if (filter.performance) {
    const range = filter.performance;
    checks.push((node, model) =>
      inRange(model.aggregates.get(node.id)?.avgPerformance ?? null, range),
    );
  }

  if (checks.length === 0) return null;

  return (node, model) => checks.every((check) => check(node, model));
}

/** Человекочитаемое описание условий — для чипов над результатом. */
export function describeFilter(filter: SearchFilter): string[] {
  const chips: string[] = [];
  const money = (value: number): string =>
    value >= 1_000_000 ? `${Math.round(value / 1_000_000)} млн` : value.toLocaleString('ru-RU');

  const range = (
    label: string,
    value: { min: number | null; max: number | null },
    format: (input: number) => string,
  ): void => {
    if (value.min !== null && value.max !== null) {
      chips.push(`${label}: ${format(value.min)}–${format(value.max)}`);
    } else if (value.min !== null) {
      chips.push(`${label}: от ${format(value.min)}`);
    } else if (value.max !== null) {
      chips.push(`${label}: до ${format(value.max)}`);
    }
  };

  if (filter.name !== null) chips.push(`Название: ${filter.name}`);

  if (filter.levels !== null && filter.levels.length > 0) {
    const names: Record<OrgLevel, string> = {
      division: 'дивизионы',
      department: 'отделы',
      team: 'команды',
    };
    chips.push(`Уровень: ${filter.levels.map((level) => names[level]).join(', ')}`);
  }

  if (filter.headcount) range('Сотрудников', filter.headcount, (value) => String(value));
  if (filter.budget) range('Бюджет', filter.budget, money);
  if (filter.performance) range('Эффективность', filter.performance, (value) => `${value}%`);

  return chips;
}
