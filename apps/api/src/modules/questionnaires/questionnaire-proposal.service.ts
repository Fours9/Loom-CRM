import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { Permission } from '../../platform/permissions/permission.names';
import { PermissionService } from '../../platform/permissions/permission.service';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import { EmployeeContactsFacade } from '../../organization/employees/employee-contacts.facade';
import { EmployeeProfileService } from '../../organization/employees/employee-profile.service';
import { QuestionnaireAssignment } from './questionnaire-assignment.entity';
import { QuestionnaireProfileProposal } from './questionnaire-profile-proposal.entity';
import { QuestionnaireResponse } from './questionnaire-response.entity';
import { QuestionnaireSubmission } from './questionnaire-submission.entity';
import {
  parsePreferredLanguage,
  serializePreferredLanguage,
} from '@loom/questionnaire-schema';
import {
  InvalidEmployeeContactsBundle,
  parseEmployeeContactsBundleStrict,
  validateEmployeeContactsBundleForWrite,
  type EmployeeContactsBundle,
  type EmployeeContactsEmergencyItem,
} from '@loom/employee-contacts';
import type { QuestionnaireProfileProposalItem } from '@loom/contracts-questionnaires';
import {
  proposalMatchesCurrentValue,
  valuesEqual,
} from './proposals/questionnaire-proposal-comparison';
import { supersedePendingForSameField } from './proposals/questionnaire-proposal-lifecycle';
import {
  buildContactsBundleProposalCandidates,
  contactsReplaceSetStale,
} from './proposals/contacts-bundle-projector';

type ProposalMapping = { section: string; field: string };
type SchemaField = {
  key: string;
  valueType?: string;
  options?: Array<{ value: string; label: string }>;
  createsProfileProposal?: boolean;
  proposalMapping?: ProposalMapping;
};
type SchemaJson = {
  steps: Array<{ fields: SchemaField[] }>;
};

function prefixAnswers(
  answers: Record<string, unknown>,
  prefix: string,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  const needle = `${prefix}.`;
  for (const [key, value] of Object.entries(answers)) {
    if (key.startsWith(needle)) {
      out[key.slice(needle.length)] = value;
    }
  }
  return Object.keys(out).length ? out : null;
}

@Injectable()
export class QuestionnaireProposalService {
  constructor(
    @InjectRepository(QuestionnaireProfileProposal)
    private readonly proposals: Repository<QuestionnaireProfileProposal>,
    @InjectRepository(QuestionnaireSubmission)
    private readonly submissions: Repository<QuestionnaireSubmission>,
    @InjectRepository(QuestionnaireResponse)
    private readonly responses: Repository<QuestionnaireResponse>,
    @InjectRepository(QuestionnaireAssignment)
    private readonly assignments: Repository<QuestionnaireAssignment>,
    private readonly access: EmployeeAccessService,
    private readonly permissions: PermissionService,
    private readonly contactsFacade: EmployeeContactsFacade,
    private readonly profiles: EmployeeProfileService,
    private readonly dataSource: DataSource,
  ) {}

  async generateFromSubmission(
    manager: EntityManager,
    _actor: User,
    submissionId: string,
  ): Promise<void> {
    const submission = await manager
      .getRepository(QuestionnaireSubmission)
      .findOne({
        where: { id: submissionId },
        relations: { response: true },
      });
    if (!submission?.response) return;

    const assignment = await manager
      .getRepository(QuestionnaireAssignment)
      .findOne({
        where: { id: submission.response.assignmentId },
        relations: { templateVersion: true },
      });
    if (!assignment?.templateVersion) return;
    if (!assignment.employeeId) return;

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    const schema = assignment.templateVersion.schemaJson as SchemaJson;
    const answers = submission.snapshotJson ?? {};
    const fieldsByKey = new Map(
      schema.steps
        .flatMap((s) => s.fields ?? [])
        .map((f) => [f.key, f] as const),
    );

    const scalarFields = schema.steps
      .flatMap((s) => s.fields ?? [])
      .filter((f) => f.createsProfileProposal && f.proposalMapping);

    const bundleFields = schema.steps
      .flatMap((s) => s.fields ?? [])
      .filter(
        (f) => f.createsProfileProposal && f.valueType === 'contacts_bundle',
      );

    const currentBundle = await this.contactsFacade.readContactsBundle(
      manager,
      employee.id,
    );
    const current = {
      ...this.readScalarCurrentProfileValues(employee),
      ...this.readContactsProfileValues(currentBundle),
    };

    const proposalRepo = manager.getRepository(QuestionnaireProfileProposal);
    const languageField = fieldsByKey.get('personal.preferred_language');
    const languageOptions = languageField?.options ?? [
      { value: 'uk', label: 'Українська' },
      { value: 'en', label: 'Англійська' },
      { value: 'other', label: 'Інша' },
    ];

    const candidates: Array<{
      targetSection: string;
      proposedChanges: {
        section: string;
        field: string;
        answerKey: string;
        from: unknown;
        to: unknown;
      };
    }> = [];

    for (const field of scalarFields) {
      const mapping = field.proposalMapping!;
      if (field.key === 'personal.preferred_language_other') continue;

      let to: unknown = answers[field.key];
      if (field.key === 'personal.preferred_language') {
        const parsed = parsePreferredLanguage(to, languageOptions);
        if (
          parsed.selected.includes('other') &&
          typeof answers['personal.preferred_language_other'] === 'string' &&
          answers['personal.preferred_language_other'].trim()
        ) {
          parsed.otherText = String(
            answers['personal.preferred_language_other'],
          ).trim();
        }
        to = serializePreferredLanguage(
          parsed.selected,
          parsed.otherText,
          languageOptions,
        );
      }

      if (to === null || to === undefined || to === '') continue;

      const fromRaw = current[`${mapping.section}.${mapping.field}`];
      let from = fromRaw;
      if (field.key === 'personal.preferred_language') {
        const fromParsed = parsePreferredLanguage(fromRaw, languageOptions);
        from = serializePreferredLanguage(
          fromParsed.selected,
          fromParsed.otherText,
          languageOptions,
        );
      }
      if (valuesEqual(from, to)) continue;

      candidates.push({
        targetSection: mapping.section,
        proposedChanges: {
          section: mapping.section,
          field: mapping.field,
          answerKey: field.key,
          from: from ?? null,
          to,
        },
      });
    }

    for (const field of bundleFields) {
      if (!Object.prototype.hasOwnProperty.call(answers, field.key)) continue;
      let bundle: EmployeeContactsBundle;
      try {
        bundle = parseEmployeeContactsBundleStrict(answers[field.key]);
        validateEmployeeContactsBundleForWrite(bundle);
      } catch (err) {
        if (err instanceof InvalidEmployeeContactsBundle) {
          throw new BadRequestException(err.message);
        }
        throw new BadRequestException('Invalid contacts bundle');
      }
      candidates.push(
        ...buildContactsBundleProposalCandidates({
          bundle,
          current: currentBundle,
          answerKey: field.key,
        }),
      );
    }

    const now = new Date();

    const allPending = await proposalRepo.find({
      where: { employeeId: employee.id, status: 'pending' },
    });
    const profileEqual = allPending.filter((p) => {
      const change = p.proposedChanges as {
        section?: string;
        field?: string;
        answerKey?: string;
      };
      const schemaField = change.answerKey
        ? fieldsByKey.get(change.answerKey)
        : null;
      const profileKey =
        change.section && change.field
          ? `${change.section}.${change.field}`
          : null;
      if (!profileKey) return false;
      return proposalMatchesCurrentValue({
        proposal: p,
        currentProfileValue: current[profileKey],
        schemaField,
      });
    });
    for (const p of profileEqual) {
      p.status = 'superseded';
      p.reviewedByUserId = null;
      p.reviewedAt = now;
    }
    if (profileEqual.length) await proposalRepo.save(profileEqual);

    for (const c of candidates) {
      await supersedePendingForSameField(manager, {
        employeeId: employee.id,
        section: c.proposedChanges.section,
        field: c.proposedChanges.field,
        now,
      });
    }

    if (!candidates.length) return;

    const rows = candidates.map((c) =>
      proposalRepo.create({
        submissionId: submission.id,
        employeeId: employee.id,
        targetSection: c.targetSection,
        proposedChanges: c.proposedChanges,
        status: 'pending',
      }),
    );
    await proposalRepo.save(rows);
  }

  async listForEmployee(actor: User, employeeId: string) {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, employee);

    if (
      !this.permissions.has(actor.role, Permission.QuestionnairesView) &&
      !this.access.isOwner(actor, employee)
    ) {
      throw new ForbiddenException('Cannot view proposals');
    }

    const items = await this.proposals.find({
      where: { employeeId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });

    const assignmentBySubmission = await this.assignmentIdsBySubmissionIds(
      items.map((p) => p.submissionId),
    );
    const schemaByAssignment = await this.schemasByAssignmentIds([
      ...assignmentBySubmission.values(),
    ]);

    const currentBundle = await this.contactsFacade.readContactsBundle(
      this.dataSource.manager,
      employeeId,
    );
    const current = {
      ...this.readScalarCurrentProfileValues(employee),
      ...this.readContactsProfileValues(currentBundle),
    };

    const dtos: QuestionnaireProfileProposalItem[] = [];
    for (const p of items) {
      const assignmentId = assignmentBySubmission.get(p.submissionId);
      if (!assignmentId) continue;

      const change = p.proposedChanges as {
        section?: string;
        field?: string;
        answerKey?: string;
      };
      const schema = schemaByAssignment.get(assignmentId);
      const schemaField = change.answerKey
        ? schema?.fieldsByKey.get(change.answerKey)
        : undefined;
      const profileKey =
        change.section && change.field
          ? `${change.section}.${change.field}`
          : null;
      if (
        profileKey &&
        proposalMatchesCurrentValue({
          proposal: p,
          currentProfileValue: current[profileKey],
          schemaField,
        })
      ) {
        continue;
      }

      dtos.push(this.toDto(p, assignmentId));
    }

    return {
      items: dtos,
      capabilities: {
        canApply: this.permissions.has(
          actor.role,
          Permission.QuestionnairesApplyProfileChanges,
        ),
      },
    };
  }

  async accept(actor: User, proposalId: string) {
    if (
      !this.permissions.has(
        actor.role,
        Permission.QuestionnairesApplyProfileChanges,
      )
    ) {
      throw new ForbiddenException('Cannot apply profile changes');
    }

    const proposal = await this.proposals.findOne({
      where: { id: proposalId },
      relations: { submission: { response: true } },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status !== 'pending') {
      throw new BadRequestException(`Proposal is ${proposal.status}`);
    }

    const assignmentId = proposal.submission?.response?.assignmentId;
    if (!assignmentId) {
      throw new NotFoundException('Proposal assignment not found');
    }

    const employee = await this.access.getEmployeeOrFail(proposal.employeeId);
    await this.access.requireCanView(actor, employee);

    const change = proposal.proposedChanges as {
      section: string;
      field: string;
      answerKey?: string;
      from?: unknown;
      to: unknown;
    };

    await this.dataSource.transaction(async (manager) => {
      const locked = await manager
        .getRepository(QuestionnaireProfileProposal)
        .findOne({
          where: { id: proposalId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!locked || locked.status !== 'pending') {
        throw new BadRequestException('Proposal is no longer pending');
      }

      await this.applyChangeInTransaction(manager, actor, proposal.employeeId, change);

      locked.status = 'accepted';
      locked.reviewedByUserId = actor.id;
      locked.reviewedAt = new Date();
      await manager.getRepository(QuestionnaireProfileProposal).save(locked);

      await supersedePendingForSameField(manager, {
        employeeId: proposal.employeeId,
        section: change.section,
        field: change.field,
        exceptProposalId: proposal.id,
      });
    });

    const saved = await this.proposals.findOne({ where: { id: proposalId } });
    if (!saved) throw new NotFoundException('Proposal not found');
    return this.toDto(saved, assignmentId);
  }

  async reject(actor: User, proposalId: string) {
    if (
      !this.permissions.has(
        actor.role,
        Permission.QuestionnairesApplyProfileChanges,
      )
    ) {
      throw new ForbiddenException('Cannot reject profile changes');
    }

    const proposal = await this.proposals.findOne({
      where: { id: proposalId },
      relations: { submission: { response: true } },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status !== 'pending') {
      throw new BadRequestException(`Proposal is ${proposal.status}`);
    }

    const assignmentId = proposal.submission?.response?.assignmentId;
    if (!assignmentId) {
      throw new NotFoundException('Proposal assignment not found');
    }

    const employee = await this.access.getEmployeeOrFail(proposal.employeeId);
    await this.access.requireCanView(actor, employee);

    proposal.status = 'rejected';
    proposal.reviewedByUserId = actor.id;
    proposal.reviewedAt = new Date();
    await this.proposals.save(proposal);

    return this.toDto(proposal, assignmentId);
  }

  async latestSnapshotSummary(
    actor: User,
    employeeId: string,
    assignmentId?: string | null,
  ) {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, employee);

    const empty = {
      submittedAt: null as string | null,
      experience: null,
      education: null,
      strengths: null,
      hobbies: null,
      workStyle: null,
    };

    const scopedId = assignmentId || null;

    const assignments = scopedId
      ? await this.assignments.find({
          where: { id: scopedId, employeeId },
        })
      : await this.assignments.find({
          where: { employeeId },
          order: { createdAt: 'DESC' },
        });

    for (const assignment of assignments) {
      const response = await this.responses.findOne({
        where: { assignmentId: assignment.id },
      });
      if (!response) continue;
      const submission = await this.submissions.findOne({
        where: { responseId: response.id },
        order: { submissionNumber: 'DESC' },
      });
      if (!submission) continue;

      const answers = submission.snapshotJson ?? {};
      return {
        submittedAt: submission.submittedAt.toISOString(),
        experience: prefixAnswers(answers, 'experience'),
        education: prefixAnswers(answers, 'education'),
        strengths: prefixAnswers(answers, 'strengths'),
        hobbies: prefixAnswers(answers, 'hobbies'),
        workStyle: prefixAnswers(answers, 'work_style'),
      };
    }

    return empty;
  }

  private async applyChangeInTransaction(
    manager: EntityManager,
    actor: User,
    employeeId: string,
    change: {
      section: string;
      field: string;
      from?: unknown;
      to: unknown;
    },
  ): Promise<void> {
    if (change.section === 'overview' || change.section === 'header') {
      const value =
        typeof change.to === 'string'
          ? change.to
          : change.to == null
            ? null
            : String(change.to);
      const dto: Record<string, string | null> = {};
      if (change.field === 'lastName') dto.lastName = value ?? '';
      if (change.field === 'firstName') dto.firstName = value ?? '';
      if (change.field === 'middleName') dto.middleName = value;
      if (change.field === 'preferredName') dto.preferredName = value;
      await this.profiles.patchBasic(actor, employeeId, dto);
      return;
    }

    if (change.section === 'personal') {
      const value =
        typeof change.to === 'string'
          ? change.to
          : change.to == null
            ? null
            : String(change.to);
      const dto: Record<string, string | null> = {};
      if (change.field === 'birthDate') dto.birthDate = value;
      if (change.field === 'city') dto.city = value;
      if (change.field === 'preferredLanguage') dto.preferredLanguage = value;
      if (change.field === 'preferredName') dto.preferredName = value;
      await this.profiles.patchPersonal(actor, employeeId, dto);
      return;
    }

    if (change.section === 'contacts') {
      await this.applyContactChangeInTransaction(
        manager,
        actor,
        employeeId,
        change,
      );
      return;
    }

    throw new BadRequestException(
      `Unsupported proposal section: ${change.section}`,
    );
  }

  private async applyContactChangeInTransaction(
    manager: EntityManager,
    actor: User,
    employeeId: string,
    change: {
      field: string;
      from?: unknown;
      to: unknown;
    },
  ): Promise<void> {
    const current = await this.contactsFacade.readContactsBundle(
      manager,
      employeeId,
    );

    if (
      change.field === 'workEmail' ||
      change.field === 'workPhone' ||
      change.field === 'workTelegram'
    ) {
      const key =
        change.field === 'workEmail'
          ? 'email'
          : change.field === 'workPhone'
            ? 'phone'
            : 'telegram';
      const currentVal = current.work[key];
      const nextVal =
        typeof change.to === 'string'
          ? change.to.trim() || null
          : change.to == null
            ? null
            : String(change.to);
      if (valuesEqual(currentVal, nextVal)) return;
      if (
        change.from !== undefined &&
        !valuesEqual(currentVal, change.from)
      ) {
        throw new ConflictException('PROFILE_CHANGED');
      }
      await this.contactsFacade.applyWorkContacts(
        manager,
        actor,
        employeeId,
        { ...current.work, [key]: nextVal },
      );
      return;
    }

    if (change.field === 'personal_replace') {
      const verdict = contactsReplaceSetStale(
        current.personal,
        change.from,
        change.to,
      );
      if (verdict === 'already_satisfied') return;
      if (verdict === 'stale') {
        throw new ConflictException('PROFILE_CHANGED');
      }
      const personal = Array.isArray(change.to) ? change.to : [];
      try {
        await this.contactsFacade.replacePersonalContacts(
          manager,
          actor,
          employeeId,
          personal.map((row) => {
            const item = row as Record<string, unknown>;
            return {
              type: String(item.type) as
                | 'personal_phone'
                | 'personal_email'
                | 'personal_telegram',
              value: String(item.value ?? ''),
              isPrimary: Boolean(item.isPrimary),
            };
          }),
        );
      } catch {
        throw new BadRequestException('Invalid personal contacts proposal');
      }
      return;
    }

    if (change.field === 'emergency_replace') {
      const verdict = contactsReplaceSetStale(
        current.emergency,
        change.from,
        change.to,
      );
      if (verdict === 'already_satisfied') return;
      if (verdict === 'stale') {
        throw new ConflictException('PROFILE_CHANGED');
      }
      const emergency = (Array.isArray(change.to) ? change.to : []).map(
        (row) => {
          const item = row as Record<string, unknown>;
          return {
            fullName: String(item.fullName ?? ''),
            relationship: String(item.relationship ?? ''),
            primaryPhone: String(item.primaryPhone ?? ''),
            secondaryPhone: String(item.secondaryPhone ?? ''),
            notes: String(item.notes ?? ''),
          } satisfies EmployeeContactsEmergencyItem;
        },
      );
      try {
        validateEmployeeContactsBundleForWrite({
          ...current,
          emergency,
        });
      } catch (err) {
        if (err instanceof InvalidEmployeeContactsBundle) {
          throw new BadRequestException(err.message);
        }
        throw new BadRequestException('Invalid emergency contacts proposal');
      }
      await this.contactsFacade.replaceEmergencyContacts(
        manager,
        actor,
        employeeId,
        emergency,
      );
      return;
    }

    throw new BadRequestException(`Unsupported contact field: ${change.field}`);
  }

  private readScalarCurrentProfileValues(employee: {
    lastName: string;
    firstName: string;
    middleName: string | null;
    preferredName: string | null;
    birthDate: string | null;
    city: string | null;
    preferredLanguage: string | null;
  }): Record<string, unknown> {
    return {
      'overview.lastName': employee.lastName,
      'overview.firstName': employee.firstName,
      'overview.middleName': employee.middleName,
      'header.preferredName': employee.preferredName,
      'personal.birthDate': employee.birthDate,
      'personal.city': employee.city,
      'personal.preferredLanguage': employee.preferredLanguage,
    };
  }

  private readContactsProfileValues(
    bundle: EmployeeContactsBundle,
  ): Record<string, unknown> {
    return {
      'contacts.workEmail': bundle.work.email,
      'contacts.workPhone': bundle.work.phone,
      'contacts.workTelegram': bundle.work.telegram,
      'contacts.personal_replace': bundle.personal,
      'contacts.emergency_replace': bundle.emergency,
    };
  }

  private toDto(
    p: QuestionnaireProfileProposal,
    assignmentId: string,
  ): QuestionnaireProfileProposalItem {
    return {
      id: p.id,
      submissionId: p.submissionId,
      assignmentId,
      employeeId: p.employeeId,
      targetSection: p.targetSection,
      proposedChanges: p.proposedChanges as QuestionnaireProfileProposalItem['proposedChanges'],
      status: p.status,
      reviewedByUserId: p.reviewedByUserId,
      reviewedAt: p.reviewedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  }

  private async assignmentIdsBySubmissionIds(
    submissionIds: string[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(submissionIds.filter(Boolean))];
    const map = new Map<string, string>();
    if (!unique.length) return map;

    const rows = await this.submissions.find({
      where: { id: In(unique) },
      relations: { response: true },
    });
    for (const row of rows) {
      const assignmentId = row.response?.assignmentId;
      if (assignmentId) map.set(row.id, assignmentId);
    }
    return map;
  }

  private async schemasByAssignmentIds(
    assignmentIds: string[],
  ): Promise<
    Map<string, { fieldsByKey: Map<string, SchemaField> }>
  > {
    const unique = [...new Set(assignmentIds.filter(Boolean))];
    const map = new Map<string, { fieldsByKey: Map<string, SchemaField> }>();
    if (!unique.length) return map;

    const rows = await this.assignments.find({
      where: { id: In(unique) },
      relations: { templateVersion: true },
    });
    for (const row of rows) {
      const schema = row.templateVersion?.schemaJson as SchemaJson | undefined;
      const fieldsByKey = new Map(
        (schema?.steps ?? [])
          .flatMap((s) => s.fields ?? [])
          .map((f) => [f.key, f] as const),
      );
      map.set(row.id, { fieldsByKey });
    }
    return map;
  }
}
