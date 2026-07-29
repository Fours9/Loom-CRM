import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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

type ProposalMapping = { section: string; field: string };
type SchemaField = {
  key: string;
  createsProfileProposal?: boolean;
  proposalMapping?: ProposalMapping;
};
type SchemaJson = {
  steps: Array<{ fields: SchemaField[] }>;
};

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'string' || typeof b === 'string') {
    return String(a).trim() === String(b).trim();
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

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

  async generateFromSubmission(
    _actor: User,
    submissionId: string,
  ): Promise<void> {
    const submission = await this.submissions.findOne({
      where: { id: submissionId },
      relations: { response: true },
    });
    if (!submission) return;

    const assignment = await this.assignments.findOne({
      where: { id: submission.response.assignmentId },
      relations: { templateVersion: true },
    });
    if (!assignment) return;

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    const schema = assignment.templateVersion.schemaJson as SchemaJson;
    const answers = submission.snapshotJson ?? {};

    const fields = schema.steps.flatMap((s) => s.fields ?? []).filter(
      (f) => f.createsProfileProposal && f.proposalMapping,
    );

    const current = this.readCurrentProfileValues(employee, await this.loadContacts(employee.id));

    const rows: QuestionnaireProfileProposal[] = [];
    for (const field of fields) {
      const mapping = field.proposalMapping!;
      let to = answers[field.key];

      // preferred_language_other only applies when language === other
      if (field.key === 'personal.preferred_language_other') {
        if (answers['personal.preferred_language'] !== 'other') continue;
      }
      if (field.key === 'personal.preferred_language') {
        if (to === 'other') {
          to = answers['personal.preferred_language_other'] ?? to;
        }
      }

      if (to === null || to === undefined || to === '') continue;

      const from = current[`${mapping.section}.${mapping.field}`];
      if (valuesEqual(from, to)) continue;

      // Skip duplicate preferredLanguage from preferred_language_other if already queued
      if (
        field.key === 'personal.preferred_language_other' &&
        rows.some(
          (r) =>
            (r.proposedChanges as { answerKey?: string }).answerKey ===
            'personal.preferred_language',
        )
      ) {
        continue;
      }

      rows.push(
        this.proposals.create({
          submissionId: submission.id,
          employeeId: employee.id,
          targetSection: mapping.section,
          proposedChanges: {
            section: mapping.section,
            field: mapping.field,
            answerKey: field.key,
            from: from ?? null,
            to,
          },
          status: 'pending',
        }),
      );
    }

    if (rows.length) {
      await this.proposals.save(rows);
    }
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
      where: { employeeId },
      order: { createdAt: 'DESC' },
    });

    return {
      items: items.map((p) => this.toDto(p)),
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

    const proposal = await this.proposals.findOne({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status !== 'pending') {
      throw new BadRequestException(`Proposal is ${proposal.status}`);
    }

    const employee = await this.access.getEmployeeOrFail(proposal.employeeId);
    await this.access.requireCanView(actor, employee);

    const change = proposal.proposedChanges as {
      section: string;
      field: string;
      to: unknown;
    };

    await this.applyChange(actor, proposal.employeeId, change);

    proposal.status = 'accepted';
    proposal.reviewedByUserId = actor.id;
    proposal.reviewedAt = new Date();
    await this.proposals.save(proposal);

    return this.toDto(proposal);
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

    const proposal = await this.proposals.findOne({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status !== 'pending') {
      throw new BadRequestException(`Proposal is ${proposal.status}`);
    }

    const employee = await this.access.getEmployeeOrFail(proposal.employeeId);
    await this.access.requireCanView(actor, employee);

    proposal.status = 'rejected';
    proposal.reviewedByUserId = actor.id;
    proposal.reviewedAt = new Date();
    await this.proposals.save(proposal);

    return this.toDto(proposal);
  }

  async latestSnapshotSummary(actor: User, employeeId: string) {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, employee);

    const assignments = await this.assignments.find({
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

    return {
      submittedAt: null,
      experience: null,
      education: null,
      strengths: null,
      hobbies: null,
      workStyle: null,
    };
  }

  private async applyChange(
    actor: User,
    employeeId: string,
    change: { section: string; field: string; to: unknown },
  ): Promise<void> {
    const value =
      typeof change.to === 'string' ? change.to : change.to == null ? null : String(change.to);

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
        // remove primary of this type if clearing
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

    // Ensure at least one primary per type that has values
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

  private toDto(p: QuestionnaireProfileProposal) {
    return {
      id: p.id,
      submissionId: p.submissionId,
      employeeId: p.employeeId,
      targetSection: p.targetSection,
      proposedChanges: p.proposedChanges,
      status: p.status,
      reviewedByUserId: p.reviewedByUserId,
      reviewedAt: p.reviewedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  }
}
