import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { Permission } from '../../platform/permissions/permission.names';
import { PermissionService } from '../../platform/permissions/permission.service';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import { EmployeeProfileService } from '../../organization/employees/employee-profile.service';
import { EmployeeContact } from '../../organization/employees/employee-contact.entity';
import { PERSONAL_CONTACT_TYPES } from '../../organization/employees/employee-personal-contacts';
import { QuestionnaireAssignment } from './questionnaire-assignment.entity';
import { QuestionnaireProfileProposal } from './questionnaire-profile-proposal.entity';
import { QuestionnaireResponse } from './questionnaire-response.entity';
import { QuestionnaireSubmission } from './questionnaire-submission.entity';
import {
  parsePreferredLanguage,
  serializePreferredLanguage,
} from '@loom/questionnaire-schema';
import type { QuestionnaireProfileProposalItem } from '@loom/contracts-questionnaires';
import {
  proposalMatchesCurrentValue,
  valuesEqual,
} from './proposals/questionnaire-proposal-comparison';
import { supersedePendingForSameField } from './proposals/questionnaire-proposal-lifecycle';

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
    @InjectRepository(EmployeeContact)
    private readonly contacts: Repository<EmployeeContact>,
    private readonly access: EmployeeAccessService,
    private readonly permissions: PermissionService,
    private readonly profiles: EmployeeProfileService,
  ) {}

  /**
   * Build and persist proposals for a new submission.
   * Must run inside the same transaction as submission create when called from submit.
   */
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

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    const schema = assignment.templateVersion.schemaJson as SchemaJson;
    const answers = submission.snapshotJson ?? {};
    const fieldsByKey = new Map(
      schema.steps
        .flatMap((s) => s.fields ?? [])
        .map((f) => [f.key, f] as const),
    );

    const fields = schema.steps
      .flatMap((s) => s.fields ?? [])
      .filter((f) => f.createsProfileProposal && f.proposalMapping);

    const contacts = await manager.getRepository(EmployeeContact).find({
      where: {
        employeeId: employee.id,
        type: In([...PERSONAL_CONTACT_TYPES]),
      },
    });
    const current = this.readCurrentProfileValues(employee, contacts);

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

    for (const field of fields) {
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

    const now = new Date();

    // Supersede pending that already match current profile (any submission).
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

    // Supersede older pending for the same target fields we are about to insert.
    for (const c of candidates) {
      await supersedePendingForSameField(manager, {
        employeeId: employee.id,
        section: c.proposedChanges.section,
        field: c.proposedChanges.field,
        answerKey: c.proposedChanges.answerKey,
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

    const current = this.readCurrentProfileValues(
      employee,
      await this.loadContacts(employeeId),
    );

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
        continue; // read-time suppression only
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
      to: unknown;
    };

    await this.applyChange(actor, proposal.employeeId, change);

    proposal.status = 'accepted';
    proposal.reviewedByUserId = actor.id;
    proposal.reviewedAt = new Date();
    await this.proposals.save(proposal);

    await supersedePendingForSameField(this.proposals.manager, {
      employeeId: proposal.employeeId,
      section: change.section,
      field: change.field,
      answerKey: change.answerKey,
      exceptProposalId: proposal.id,
    });

    return this.toDto(proposal, assignmentId);
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

  private async applyChange(
    actor: User,
    employeeId: string,
    change: { section: string; field: string; to: unknown },
  ): Promise<void> {
    const value =
      typeof change.to === 'string'
        ? change.to
        : change.to == null
          ? null
          : String(change.to);

    if (change.section === 'overview' || change.section === 'header') {
      const dto: Record<string, string | null> = {};
      if (change.field === 'lastName') dto.lastName = value ?? '';
      if (change.field === 'firstName') dto.firstName = value ?? '';
      if (change.field === 'middleName') dto.middleName = value;
      if (change.field === 'preferredName') dto.preferredName = value;
      await this.profiles.patchBasic(actor, employeeId, dto);
      return;
    }

    if (change.section === 'personal') {
      const dto: Record<string, string | null> = {};
      if (change.field === 'birthDate') dto.birthDate = value;
      if (change.field === 'city') dto.city = value;
      if (change.field === 'preferredLanguage') dto.preferredLanguage = value;
      if (change.field === 'preferredName') dto.preferredName = value;
      await this.profiles.patchPersonal(actor, employeeId, dto);
      return;
    }

    if (change.section === 'contacts') {
      await this.applyContactChange(actor, employeeId, change.field, value);
      return;
    }

    throw new BadRequestException(
      `Unsupported proposal section: ${change.section}`,
    );
  }

  private async applyContactChange(
    actor: User,
    employeeId: string,
    field: string,
    value: string | null,
  ): Promise<void> {
    const existing = await this.loadContacts(employeeId);
    const next = existing.map((c) => ({
      type: c.type as 'personal_phone' | 'personal_email' | 'personal_telegram',
      value: c.value,
      isPrimary: c.isPrimary,
    }));

    const upsert = (
      type: 'personal_phone' | 'personal_email' | 'personal_telegram',
      val: string | null,
      asPrimary: boolean,
    ) => {
      if (!val) {
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].type === type && next[i].isPrimary === asPrimary) {
            next.splice(i, 1);
          }
        }
        return;
      }
      const idx = next.findIndex(
        (c) => c.type === type && c.isPrimary === asPrimary,
      );
      if (idx >= 0) next[idx].value = val;
      else next.push({ type, value: val, isPrimary: asPrimary });
    };

    if (field === 'personal_phone') upsert('personal_phone', value, true);
    else if (field === 'personal_phone_secondary')
      upsert('personal_phone', value, false);
    else if (field === 'personal_email') upsert('personal_email', value, true);
    else if (field === 'personal_telegram')
      upsert('personal_telegram', value, true);
    else {
      throw new BadRequestException(`Unsupported contact field: ${field}`);
    }

    for (const type of PERSONAL_CONTACT_TYPES) {
      const ofType = next.filter((c) => c.type === type);
      if (ofType.length && !ofType.some((c) => c.isPrimary)) {
        ofType[0].isPrimary = true;
      }
    }

    await this.profiles.replacePersonalContacts(actor, employeeId, next);
  }

  private async loadContacts(employeeId: string): Promise<EmployeeContact[]> {
    return this.contacts.find({
      where: {
        employeeId,
        type: In([...PERSONAL_CONTACT_TYPES]),
      },
    });
  }

  private readCurrentProfileValues(
    employee: {
      lastName: string;
      firstName: string;
      middleName: string | null;
      preferredName: string | null;
      birthDate: string | null;
      city: string | null;
      preferredLanguage: string | null;
      personalPhoneNumber: string | null;
      personalEmail: string | null;
      personalTelegram: string | null;
    },
    contacts: EmployeeContact[],
  ): Record<string, unknown> {
    const primaryPhone =
      contacts.find((c) => c.type === 'personal_phone' && c.isPrimary)?.value ??
      employee.personalPhoneNumber;
    const secondaryPhone =
      contacts.find((c) => c.type === 'personal_phone' && !c.isPrimary)?.value ??
      null;
    const email =
      contacts.find((c) => c.type === 'personal_email' && c.isPrimary)?.value ??
      employee.personalEmail;
    const telegram =
      contacts.find((c) => c.type === 'personal_telegram' && c.isPrimary)
        ?.value ?? employee.personalTelegram;

    return {
      'overview.lastName': employee.lastName,
      'overview.firstName': employee.firstName,
      'overview.middleName': employee.middleName,
      'header.preferredName': employee.preferredName,
      'personal.birthDate': employee.birthDate,
      'personal.city': employee.city,
      'personal.preferredLanguage': employee.preferredLanguage,
      'contacts.personal_phone': primaryPhone,
      'contacts.personal_phone_secondary': secondaryPhone,
      'contacts.personal_email': email,
      'contacts.personal_telegram': telegram,
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
