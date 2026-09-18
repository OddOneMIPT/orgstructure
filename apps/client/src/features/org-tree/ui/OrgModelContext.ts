import { createContext } from 'react';

import { EMPTY_MODEL, type OrgModel } from '@/entities/org';

/**
 * Модель раздаётся контекстом, чтобы пропсы узла остались примитивами
 * и `memo` не сбрасывался на каждой перерисовке родителя.
 */
export const OrgModelContext = createContext<OrgModel>(EMPTY_MODEL);
