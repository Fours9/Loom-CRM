import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../platform/identity/user.entity';
import { EmployeeAccessService } from '../../../organization/access/employee-access.service';
import { AbsenceRequest } from '../absence-request.entity';
import { AbsenceRequestStatus } from '../absence.enums';
import {
  TIME_EVENT_TYPE_LABELS,
  getTimeEventTypeDefinition,
  type TimeEventType,
  type TimeEventVisualKind,
} from '../domain/time-event-type-catalog';

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

function visualPattern(
  visualKind: TimeEventVisualKind,
): 'solid' | 'hatch_mid' | 'hatch_left' | 'hatch_right' {
  switch (visualKind) {
    case 'partial_absence':
      return 'hatch_mid';
    case 'overtime':
      return 'hatch_right';
    case 'extra_work_day':
      return 'hatch_left';
    case 'business_trip':
      // Work events use hatch (opposite direction from absences on FE).
      return 'hatch_right';
    default:
      return 'solid';
  }
}

/** Shared day axis for month/week hatch placement (matches FE list axis). */
const HATCH_AXIS_START_MIN = 8 * 60;
const HATCH_AXIS_END_MIN = 20 * 60;
const HATCH_AXIS_SPAN_MIN = HATCH_AXIS_END_MIN - HATCH_AXIS_START_MIN;

function parseHhMmToMinutes(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)/.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Map HH:mm interval onto 08:00–20:00 axis as [0..1] ratios.
 * Untimed / full-day events keep 0..1 (full band fill).
 */
function hatchRatiosFromTimes(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): { hatchStartRatio: number; hatchEndRatio: number } {
  if (!startTime || !endTime) {
    return { hatchStartRatio: 0, hatchEndRatio: 1 };
  }
  let start = parseHhMmToMinutes(startTime);
  let end = parseHhMmToMinutes(endTime);
  if (start == null || end == null) {
    return { hatchStartRatio: 0, hatchEndRatio: 1 };
  }
  if (end <= start) {
    return { hatchStartRatio: 0, hatchEndRatio: 1 };
  }
  start = Math.min(Math.max(start, HATCH_AXIS_START_MIN), HATCH_AXIS_END_MIN);
  end = Math.min(Math.max(end, HATCH_AXIS_START_MIN), HATCH_AXIS_END_MIN);
  if (end <= start) {
    return { hatchStartRatio: 0, hatchEndRatio: 1 };
  }
  return {
    hatchStartRatio: (start - HATCH_AXIS_START_MIN) / HATCH_AXIS_SPAN_MIN,
    hatchEndRatio: (end - HATCH_AXIS_START_MIN) / HATCH_AXIS_SPAN_MIN,
  };
}

/** Overflow priority: work events first, then absences, then partial. */
function overflowPriority(type: string): number {
  const def = getTimeEventTypeDefinition(type);
  if (!def) return 50;
  switch (def.visualKind) {
    case 'extra_work_day':
      return 10;
    case 'overtime':
      return 20;
    case 'business_trip':
      return 30;
    case 'absence':
      return 40;
    case 'partial_absence':
      return 50;
    default:
      return 60;
  }
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
      const covering = rows
        .filter((r) => this.covers(r, date))
        .sort(
          (a, b) => overflowPriority(a.type) - overflowPriority(b.type),
        );
      const segments = covering.map((r) => this.toSegment(r, false)).slice(0, 4);
      return {
        date,
        segments,
        overflowCount: Math.max(0, covering.length - segments.length),
      };
    });
    return {
      days,
      legend: this.buildLegend(),
    };
  }

  async getDay(actor: User, date: string) {
    const rows = await this.visibleRows(actor);
    const covering = rows
      .filter((r) => this.covers(r, date))
      .sort((a, b) => overflowPriority(a.type) - overflowPriority(b.type));
    return {
      date,
      items: covering.map((r) => this.toSegment(r, true)),
      legend: this.buildLegend(),
    };
  }

  private buildLegend() {
    return (
      Object.entries(TIME_EVENT_TYPE_LABELS) as Array<[TimeEventType, string]>
    ).map(([value, label]) => {
      const def = getTimeEventTypeDefinition(value)!;
      return {
        value,
        label,
        category: def.category,
        visualKind: def.visualKind,
        pattern: visualPattern(def.visualKind),
      };
    });
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
    return rows.filter((r) => {
      if (!ids.has(r.employeeId)) return false;
      if (
        r.status === AbsenceRequestStatus.DeletionRequested &&
        r.statusBeforeDeletionRequest === AbsenceRequestStatus.Cancelled
      ) {
        return false;
      }
      return true;
    });
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
    const def = getTimeEventTypeDefinition(r.type);
    const label =
      TIME_EVENT_TYPE_LABELS[r.type as TimeEventType] ?? r.type;
    const visualKind = def?.visualKind ?? 'absence';
    const category = def?.category ?? 'absence';
    const { hatchStartRatio, hatchEndRatio } = hatchRatiosFromTimes(
      r.absenceStartTime,
      r.absenceEndTime,
    );
    const base = {
      key: r.id,
      label,
      color,
      pattern: visualPattern(visualKind),
      hatchStartRatio,
      hatchEndRatio,
      statusGroup: statusGroup as 'approved' | 'pending',
      startTime: r.absenceStartTime ?? undefined,
      endTime: r.absenceEndTime ?? undefined,
      requestId: r.id,
      ariaLabel: `${r.employeeNameAtSubmission}: ${label}`,
      visualKind,
      category,
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
      absenceTypeLabel: label,
      eventTypeLabel: label,
      periodStart: r.startDate,
      periodEnd: end,
    };
  }
}
