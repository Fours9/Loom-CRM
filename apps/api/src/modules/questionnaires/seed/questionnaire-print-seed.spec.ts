import {
  buildQuestionnairePrintModel,
  listPrintModelFieldKeys,
  listTopLevelFields,
} from '@loom/questionnaire-schema';
import { QUESTIONNAIRE_PRINT_LAYOUT_VERSION } from '@loom/contracts-questionnaires';
import { EMPLOYEE_360_V1_SCHEMA } from './employee-360-v1.schema';
import { EMPLOYEE_STARTER_V1_SCHEMA } from './employee-starter-v1.schema';
import { EMPLOYEE_MANAGING_V1_SCHEMA } from './employee-managing-v1.schema';
import { EMPLOYEE_DOCS_V1_SCHEMA } from './employee-docs-v1.schema';

const noopFormat = {
  resolveOrgLabel: (_f: unknown, v: unknown) =>
    v == null || v === '' ? '—' : String(v),
};

const meta = (title: string, code: string) => ({
  title,
  templateCode: code,
  templateTypeLabelUa: 'Test',
  generatedAtLabel: '01.01.2026 12:00',
  generatedByLabel: 'test@example.com',
  schemaVersion: 1,
  printLayoutVersion: QUESTIONNAIRE_PRINT_LAYOUT_VERSION,
});

describe('questionnaire print model — seed schemas', () => {
  const schemas = [
    EMPLOYEE_360_V1_SCHEMA,
    EMPLOYEE_STARTER_V1_SCHEMA,
    EMPLOYEE_MANAGING_V1_SCHEMA,
    EMPLOYEE_DOCS_V1_SCHEMA,
  ];

  it.each(schemas.map((s) => [s.code, s] as const))(
    '%s blank includes every top-level field key',
    (_code, schema) => {
      const model = buildQuestionnairePrintModel({
        schema,
        answers: {},
        mode: 'blank',
        meta: meta(schema.title, schema.code),
        formatContext: noopFormat,
      });
      expect(listPrintModelFieldKeys(model).sort()).toEqual(
        listTopLevelFields(schema)
          .map((f) => f.key)
          .sort(),
      );
    },
  );
});
