import type { AboutSubtabDef, AboutSubtabId } from './types';

export const ABOUT_SUBTAB_DEFS: readonly AboutSubtabDef[] = [
  {
    id: 'family_home',
    labelUa: 'Сімʼя і дім',
    purposeUa:
      'Сімейний стан, діти, домашні тварини (family.* зі snapshot анкети).',
  },
  {
    id: 'celebrations',
    labelUa: 'Свята і подарунки',
    purposeUa:
      'Вітання з ДН, дозвіл на подарунки, формат подарунка, інші дати.',
  },
  {
    id: 'hobbies',
    labelUa: 'Хобі та інтереси',
    purposeUa:
      'Інтереси, розміри одягу для мерчу, харчові особливості, корпоративи.',
  },
  {
    id: 'strengths',
    labelUa: 'Сильні сторони',
    purposeUa: 'Що виходить найкраще, енергія / блокери, відповідальність.',
  },
  {
    id: 'work_style',
    labelUa: 'Стиль роботи',
    purposeUa:
      'Зручна комунікація, фідбек, мотиватори — мʼякий контекст для керівника.',
  },
  {
    id: 'life_goals',
    labelUa: 'Цілі',
    purposeUa:
      'Життєві / карʼєрні орієнтири (strengths.in_* + career_goals.plan).',
  },
] as const;

export function isAboutSubtabId(value: string): value is AboutSubtabId {
  return ABOUT_SUBTAB_DEFS.some((s) => s.id === value);
}
