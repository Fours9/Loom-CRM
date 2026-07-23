import { CalendarSegmentSummary } from '../core/api/models';
import { parseTimeToMinutes } from '../core/schedule/work-time.util';

/** Shared list-mode day axis (absolute clock), covers typical shifts. */
export const LIST_AXIS_START_MIN = 8 * 60;
export const LIST_AXIS_END_MIN = 20 * 60;
export const LIST_AXIS_SPAN_MIN = LIST_AXIS_END_MIN - LIST_AXIS_START_MIN;

export interface ListAxisPlacement {
  leftPct: number;
  widthPct: number;
}

/** Hour labels for the list timeline header (inclusive start, exclusive end). */
export function listAxisHourLabels(): string[] {
  const labels: string[] = [];
  for (let h = LIST_AXIS_START_MIN / 60; h < LIST_AXIS_END_MIN / 60; h++) {
    labels.push(String(h).padStart(2, '0'));
  }
  return labels;
}

export function listAxisHourCount(): number {
  return LIST_AXIS_SPAN_MIN / 60;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Place a segment on the shared hour axis.
 * Partial days use absolute start/end times; full-day / solid fill the track;
 * otherwise hatch ratios map onto the axis as a fallback.
 */
export function listAxisPlacement(segment: CalendarSegmentSummary): ListAxisPlacement {
  const startHm = segment.startTime?.slice(0, 5);
  const endHm = segment.endTime?.slice(0, 5);

  if (startHm && endHm) {
    let start = parseTimeToMinutes(startHm);
    let end = parseTimeToMinutes(endHm);
    if (end <= start) {
      end += 24 * 60;
    }
    start = clamp(start, LIST_AXIS_START_MIN, LIST_AXIS_END_MIN);
    end = clamp(end, LIST_AXIS_START_MIN, LIST_AXIS_END_MIN);
    if (end <= start) {
      return { leftPct: 0, widthPct: 100 };
    }
    const leftPct = ((start - LIST_AXIS_START_MIN) / LIST_AXIS_SPAN_MIN) * 100;
    const widthPct = Math.max(((end - start) / LIST_AXIS_SPAN_MIN) * 100, 1.5);
    return { leftPct, widthPct: Math.min(widthPct, 100 - leftPct) };
  }

  const solidFull =
    segment.pattern === 'solid' ||
    (segment.hatchStartRatio <= 0.001 && segment.hatchEndRatio >= 0.999);
  if (solidFull) {
    return { leftPct: 0, widthPct: 100 };
  }

  const leftPct = clamp(segment.hatchStartRatio, 0, 1) * 100;
  const widthPct = Math.max(
    (clamp(segment.hatchEndRatio, 0, 1) - clamp(segment.hatchStartRatio, 0, 1)) * 100,
    1.5,
  );
  return { leftPct, widthPct: Math.min(widthPct, 100 - leftPct) };
}
