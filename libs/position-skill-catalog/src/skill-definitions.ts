/**
 * Stable skill codes shared by questionnaire Track B answers and Organization skills seed.
 * Labels from docs/product/references/anketa_360.html § skills; codes must not drift.
 */

export const SKILL_GROUP_CODES = ['TECH', 'BEAUTY', 'OFFICE'] as const;
export type SkillGroupCode = (typeof SKILL_GROUP_CODES)[number];

export type SkillDefinition = {
  code: string;
  group: SkillGroupCode;
  labelUa: string;
  sortOrder: number;
};

/** Scale used by position_skills_matrix (plan + Profile Core §17). */
export const SKILL_LEVEL_MIN = 0;
export const SKILL_LEVEL_MAX = 5;

export const SKILL_DEFINITIONS: readonly SkillDefinition[] = [
  // TECH
  { code: 'packing', group: 'TECH', labelUa: 'Фасування / пакування', sortOrder: 10 },
  { code: 'quality_control', group: 'TECH', labelUa: 'Контроль якості продукції', sortOrder: 20 },
  { code: 'equipment', group: 'TECH', labelUa: 'Робота з обладнанням', sortOrder: 30 },
  { code: 'sewing', group: 'TECH', labelUa: 'Пошиття / крій', sortOrder: 40 },
  { code: 'patterns', group: 'TECH', labelUa: 'Робота з лекалами', sortOrder: 50 },
  { code: 'warehouse_accounting', group: 'TECH', labelUa: 'Складський облік', sortOrder: 60 },
  { code: 'inventory', group: 'TECH', labelUa: 'Інвентаризація', sortOrder: 70 },
  { code: 'logistics', group: 'TECH', labelUa: 'Логістика / доставка', sortOrder: 80 },
  // BEAUTY
  { code: 'manicure_pedicure', group: 'BEAUTY', labelUa: 'Манікюр / педикюр', sortOrder: 10 },
  { code: 'gel_polish', group: 'BEAUTY', labelUa: 'Гель-лак / покриття', sortOrder: 20 },
  { code: 'nail_design', group: 'BEAUTY', labelUa: 'Дизайн нігтів', sortOrder: 30 },
  { code: 'customer_service', group: 'BEAUTY', labelUa: 'Обслуговування клієнтів', sortOrder: 40 },
  { code: 'cashier', group: 'BEAUTY', labelUa: 'Касова робота', sortOrder: 50 },
  { code: 'phone_admin', group: 'BEAUTY', labelUa: 'Прийом дзвінків / адміністрування', sortOrder: 60 },
  // OFFICE
  { code: 'google_sheets_excel', group: 'OFFICE', labelUa: 'Excel / Google Sheets', sortOrder: 10 },
  { code: 'word_docs', group: 'OFFICE', labelUa: 'Word / Google Docs', sortOrder: 20 },
  { code: 'bas_1c', group: 'OFFICE', labelUa: '1С / BAS', sortOrder: 30 },
  { code: 'crm_systems', group: 'OFFICE', labelUa: 'CRM-системи', sortOrder: 40 },
  { code: 'sales_b2b', group: 'OFFICE', labelUa: 'Продажі B2B', sortOrder: 50 },
  { code: 'sales_b2c', group: 'OFFICE', labelUa: 'Продажі B2C', sortOrder: 60 },
  { code: 'negotiations', group: 'OFFICE', labelUa: 'Ведення переговорів', sortOrder: 70 },
  { code: 'recruiting', group: 'OFFICE', labelUa: 'Підбір персоналу', sortOrder: 80 },
  { code: 'teaching_others', group: 'OFFICE', labelUa: 'Навчання інших', sortOrder: 90 },
  { code: 'team_management', group: 'OFFICE', labelUa: 'Управління командою', sortOrder: 100 },
  { code: 'financial_accounting', group: 'OFFICE', labelUa: 'Фінансовий облік', sortOrder: 110 },
  { code: 'smm_marketing', group: 'OFFICE', labelUa: 'SMM / маркетинг', sortOrder: 120 },
] as const;

const CODE_SET = new Set(SKILL_DEFINITIONS.map((s) => s.code));

export type SkillCode = (typeof SKILL_DEFINITIONS)[number]['code'];

export function isSkillCode(value: unknown): value is SkillCode {
  return typeof value === 'string' && CODE_SET.has(value);
}

export function skillDefinitionByCode(
  code: string,
): SkillDefinition | undefined {
  return SKILL_DEFINITIONS.find((s) => s.code === code);
}

export function skillsForGroup(group: SkillGroupCode): SkillDefinition[] {
  return SKILL_DEFINITIONS.filter((s) => s.group === group);
}

export const SKILL_GROUP_LABELS_UA: Record<SkillGroupCode, string> = {
  TECH: 'Технічні / виробничі',
  BEAUTY: 'Сервіс / краса',
  OFFICE: 'Офіс / управління',
};
