import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../platform/identity/user.entity';
import { EmployeeAccessService } from '../../../organization/access/employee-access.service';
import { AbsenceRequest } from '../absence-request.entity';
import { AbsenceRequestStatus, AbsenceType } from '../absence.enums';

const TYPE_LABELS: Record<string, string> = {
  day_off: 'Відгул',
  vacation: 'Відпустка',
  sick_leave: 'Лікарняний',
  part_time: 'Неповний день',
};

function todayKyiv(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + 'T12:00:00');
  const end = new Date(to + 'T12:00:00');
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

@Injectable()
export class AbsenceCalendarService {
  constructor(
    @InjectRepository(AbsenceRequest)
    private readonly requests: Repository<AbsenceRequest>,
    private readonly access: EmployeeAccessService,
  ) {}

  async getRange(actor: User, from: string, to: string) {
    const rows = await this.visibleRows(actor);
    const days = eachDate(from, to).map((date) => {
      const covering = rows.filter((r) => this.covers(r, date));
      const segments = covering.map((r) => this.toSegment(r, false)).slice(0, 4);
      return {
        date,
        segments,
        overflowCount: Math.max(0, covering.length - segments.length),
      };
    });
    return { days };
  }

  async getDay(actor: User, date: string) {
    const rows = await this.visibleRows(actor);
    const covering = rows.filter((r) => this.covers(r, date));
    return {
      date,
      items: covering.map((r) => this.toSegment(r, true)),
    };
  }

  private async visibleRows(actor: User) {
    const visible = await this.access.listVisibleEmployees(actor);
    const ids = new Set(visible.map((e) => e.id));
    const rows = await this.requests.find({
      where: [
        { status: AbsenceRequestStatus.Approved },
        { status: AbsenceRequestStatus.Pending },
        { status: AbsenceRequestStatus.DeletionRequested },
      ],
      order: { startDate: 'ASC' },
    });
    return rows.filter((r) => ids.has(r.employeeId));
  }

  private covers(r: AbsenceRequest, date: string): boolean {
    const end = r.endDate ?? r.startDate;
    return r.startDate <= date && end >= date;
  }

  private toSegment(r: AbsenceRequest, rich: boolean) {
    const end = r.endDate ?? r.startDate;
    const approvedLike =
      r.status === AbsenceRequestStatus.Approved ||
      r.status === AbsenceRequestStatus.DeletionRequested;
    const statusGroup = approvedLike ? 'approved' : 'pending';
    const periodEnded = approvedLike && end < todayKyiv();
    const color =
      r.calendarColorAtSubmission &&
      /^#[0-9A-Fa-f]{6}$/.test(r.calendarColorAtSubmission)
        ? r.calendarColorAtSubmission
        : '#64748b';
    const base = {
      key: r.id,
      label: TYPE_LABELS[r.type] ?? r.type,
      color,
      pattern: (r.type === AbsenceType.PartTime ? 'hatch_mid' : 'solid') as
        | 'solid'
        | 'hatch_mid',
      hatchStartRatio: 0,
      hatchEndRatio: 1,
      statusGroup: statusGroup as 'approved' | 'pending',
      startTime: r.absenceStartTime ?? undefined,
      endTime: r.absenceEndTime ?? undefined,
      requestId: r.id,
      ariaLabel: `${r.employeeNameAtSubmission}: ${TYPE_LABELS[r.type] ?? r.type}`,
      deletionRequested:
        r.status === AbsenceRequestStatus.DeletionRequested
          ? (true as const)
          : undefined,
      periodEnded: periodEnded ? (true as const) : undefined,
    };
    if (!rich) return base;
    return {
      ...base,
      employeeName: r.employeeNameAtSubmission,
      departmentName: undefined,
      positionName: undefined,
      absenceTypeLabel: TYPE_LABELS[r.type] ?? r.type,
      periodStart: r.startDate,
      periodEnd: end,
    };
  }
}
