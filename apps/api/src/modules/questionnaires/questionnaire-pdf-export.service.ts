import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  QUESTIONNAIRE_PRINT_LAYOUT_VERSION,
  QUESTIONNAIRE_TYPE_CATALOG,
  parseQuestionnaireContext,
  type QuestionnaireSchemaField,
  type QuestionnaireSchemaJson,
  type QuestionnaireType,
} from '@loom/contracts-questionnaires';
import {
  buildQuestionnairePrintModel,
  resolveMatrixRatingPolicy,
  resolveQuestionnairePrintSource,
} from '@loom/questionnaire-schema';
import { User } from '../../platform/identity/user.entity';
import { AuthorizationContextService } from '../../platform/access-control/authorization-context.service';
import { hasQuestionnaireTemplate } from '../../platform/access-control/authorization-context';
import { AuditService } from '../../platform/audit/audit.service';
import { PdfRenderer } from '../../platform/pdf/pdf-renderer';
import { formatKyivDateTime } from '../../organization/employees/employee-pdf-filename';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import { QuestionnaireResponse } from './questionnaire-response.entity';
import { QuestionnaireSubmission } from './questionnaire-submission.entity';
import { QuestionnaireTemplate } from './questionnaire-template.entity';
import { QuestionnaireTemplateVersion } from './questionnaire-template-version.entity';
import { QuestionnaireAssignmentService } from './questionnaire-assignment.service';
import {
  QUESTIONNAIRE_ASSIGNMENT_AUDIT,
} from './assignments/questionnaire-assignment-transitions';
import {
  requireActorAccessAssignmentTemplate,
} from './assignments/questionnaire-assignment-access';
import { buildQuestionnairePdfFilenames } from './questionnaire-pdf-filename';

@Injectable()
export class QuestionnairePdfExportService {
  constructor(
    @InjectRepository(QuestionnaireResponse)
    private readonly responses: Repository<QuestionnaireResponse>,
    @InjectRepository(QuestionnaireSubmission)
    private readonly submissions: Repository<QuestionnaireSubmission>,
    @InjectRepository(QuestionnaireTemplate)
    private readonly templates: Repository<QuestionnaireTemplate>,
    @InjectRepository(QuestionnaireTemplateVersion)
    private readonly versions: Repository<QuestionnaireTemplateVersion>,
    private readonly assignmentService: QuestionnaireAssignmentService,
    private readonly access: EmployeeAccessService,
    private readonly authorization: AuthorizationContextService,
    private readonly audit: AuditService,
    private readonly pdfRenderer: PdfRenderer,
  ) {}

  async exportAssignmentPdf(
    actor: User,
    assignmentId: string,
    options?: { expectedDraftRevision?: number },
  ): Promise<{ buffer: Buffer; asciiFilename: string; utf8Filename: string }> {
    const authz = await this.authorization.resolve(actor.id);
    const assignment =
      await this.assignmentService.loadAssignmentOrFail(assignmentId);
    await this.assignmentService.requireCanViewAssignment(
      actor,
      assignment,
      authz,
    );
    requireActorAccessAssignmentTemplate({
      authz,
      templateCode: assignment.templateVersion.template.code,
    });

    const draft = await this.responses.findOne({
      where: { assignmentId: assignment.id },
    });
    const latestSubmission = draft
      ? await this.submissions.findOne({
          where: { responseId: draft.id },
          order: { submissionNumber: 'DESC' },
        })
      : null;

    const source = resolveQuestionnairePrintSource({
      assignmentStatus: assignment.status,
      draft: draft
        ? {
            answersJson: (draft.answersJson ?? {}) as Record<string, unknown>,
            revision: draft.revision,
          }
        : null,
      latestSubmission: latestSubmission
        ? {
            id: latestSubmission.id,
            submissionNumber: latestSubmission.submissionNumber,
            snapshotJson: (latestSubmission.snapshotJson ?? {}) as Record<
              string,
              unknown
            >,
            contextJson: latestSubmission.contextJson,
          }
        : null,
      assignmentContextJson: assignment.contextJson,
    });

    if (
      source.sourceKind === 'draft' &&
      options?.expectedDraftRevision != null
    ) {
      const current = draft?.revision ?? 0;
      if (current !== options.expectedDraftRevision) {
        throw new ConflictException({
          message: 'Draft revision conflict',
          expectedDraftRevision: options.expectedDraftRevision,
          currentRevision: current,
        });
      }
    }

    const schema = assignment.templateVersion
      .schemaJson as QuestionnaireSchemaJson;
    const template = assignment.templateVersion.template;
    const type = template.type as QuestionnaireType;
    const typeLabel =
      QUESTIONNAIRE_TYPE_CATALOG[type]?.labelUa ?? String(template.type);

    let profileMirror: Record<string, unknown> | null = null;
    let employeeDisplayName: string | undefined;
    if (assignment.employeeId) {
      const emp = await this.access.getEmployeeOrFail(assignment.employeeId);
      employeeDisplayName = `${emp.lastName} ${emp.firstName}`.trim();
      if (source.sourceKind === 'draft') {
        profileMirror =
          await this.assignmentService.buildProfileMirrorForEmployee(
            actor,
            emp,
          );
      }
    }

    const formatContext = this.buildFormatContext(source.context);
    const now = new Date();
    const model = buildQuestionnairePrintModel({
      schema,
      answers: source.answers,
      profileMirror:
        source.sourceKind === 'draft' ? profileMirror ?? {} : {},
      mode: 'filled',
      meta: {
        title: schema.title || template.title,
        templateCode: template.code,
        templateTypeLabelUa: typeLabel,
        assignmentCode: assignment.code,
        employeeDisplayName,
        generatedAtLabel: formatKyivDateTime(now),
        generatedByLabel: actor.email ?? actor.id,
        schemaVersion: schema.version ?? assignment.templateVersion.version,
        printLayoutVersion: QUESTIONNAIRE_PRINT_LAYOUT_VERSION,
      },
      formatContext,
    });

    const buffer = await this.pdfRenderer.renderQuestionnaire(model);
    const names = buildQuestionnairePdfFilenames({
      templateCode: template.code,
      assignmentCode: assignment.code,
      now,
    });

    await this.audit.record({
      actorId: actor.id,
      action: QUESTIONNAIRE_ASSIGNMENT_AUDIT.exportPdf,
      entityType: 'questionnaire_assignment',
      entityId: assignment.id,
      metadata: {
        sourceKind: source.sourceKind,
        draftRevision:
          source.sourceKind === 'draft' ? source.draftRevision : undefined,
        submissionId: source.submissionId,
        submissionNumber: source.submissionNumber,
        schemaVersion: model.meta.schemaVersion,
        printLayoutVersion: model.meta.printLayoutVersion,
        filename: names.utf8Filename,
      },
    });

    return { buffer, ...names };
  }

  async exportBlankTemplatePdf(
    actor: User,
    templateCode: string,
  ): Promise<{ buffer: Buffer; asciiFilename: string; utf8Filename: string }> {
    const authz = await this.authorization.resolve(actor.id);
    if (!hasQuestionnaireTemplate(authz, templateCode)) {
      throw new NotFoundException('Questionnaire template not found');
    }

    const template = await this.templates.findOne({
      where: { code: templateCode, status: 'published' },
    });
    if (!template) {
      throw new NotFoundException('Questionnaire template not found');
    }

    const version = await this.versions
      .createQueryBuilder('v')
      .where('v.template_id = :templateId', { templateId: template.id })
      .andWhere('v.published_at IS NOT NULL')
      .orderBy('v.version', 'DESC')
      .getOne();
    if (!version) {
      throw new NotFoundException('Published template version not found');
    }

    const schema = version.schemaJson as QuestionnaireSchemaJson;
    const type = template.type as QuestionnaireType;
    const typeLabel =
      QUESTIONNAIRE_TYPE_CATALOG[type]?.labelUa ?? String(template.type);
    const now = new Date();
    const formatContext = this.buildFormatContext(null);

    const model = buildQuestionnairePrintModel({
      schema,
      answers: {},
      profileMirror: {},
      mode: 'blank',
      meta: {
        title: schema.title || template.title,
        templateCode: template.code,
        templateTypeLabelUa: typeLabel,
        generatedAtLabel: formatKyivDateTime(now),
        generatedByLabel: actor.email ?? actor.id,
        schemaVersion: schema.version ?? version.version,
        printLayoutVersion: QUESTIONNAIRE_PRINT_LAYOUT_VERSION,
      },
      formatContext,
    });

    const buffer = await this.pdfRenderer.renderQuestionnaire(model);
    const names = buildQuestionnairePdfFilenames({
      templateCode: template.code,
      blank: true,
      now,
    });

    await this.audit.record({
      actorId: actor.id,
      action: QUESTIONNAIRE_ASSIGNMENT_AUDIT.exportBlankPdf,
      entityType: 'questionnaire_template',
      entityId: template.id,
      metadata: {
        templateCode: template.code,
        schemaVersion: model.meta.schemaVersion,
        printLayoutVersion: model.meta.printLayoutVersion,
        filename: names.utf8Filename,
      },
    });

    return { buffer, ...names };
  }

  private buildFormatContext(contextJson: Record<string, unknown> | null) {
    const parsed = contextJson
      ? parseQuestionnaireContext(contextJson)
      : { ok: false as const };
    const ctx = parsed.ok ? parsed.context : null;
    const catalog = ctx?.positionCatalog;
    const skillsByCode = new Map(
      (catalog?.skills ?? []).map((s) => [s.code, s]),
    );
    const version = ctx?.version ?? null;

    return {
      resolveOrgLabel: (field: QuestionnaireSchemaField, value: unknown) => {
        if (value === null || value === undefined || value === '') return '—';
        const entity = field.organizationEntity;
        if (!entity) return String(value);
        if (entity === 'work_format' || entity === 'employment_type') {
          return typeof value === 'string' ? value : String(value);
        }
        if (typeof value !== 'string') return String(value);
        if (!catalog) return value;
        if (entity === 'direction' && catalog.directionId === value) {
          return catalog.directionName ?? value;
        }
        if (entity === 'department' && catalog.departmentId === value) {
          return catalog.departmentName ?? value;
        }
        if (entity === 'position' && catalog.positionId === value) {
          return catalog.positionName ?? value;
        }
        return value;
      },
      resolveSkillLabel: (code: string) =>
        skillsByCode.get(code)?.labelUa ?? code,
      formatMatrixLevel: (code: string, level: number) => {
        const policy = resolveMatrixRatingPolicy(
          version,
          skillsByCode.get(code) ?? null,
        );
        return policy.unit === '%' ? `${level}%` : String(level);
      },
    };
  }
}
