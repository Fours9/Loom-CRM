import {
  TIME_EVENT_TYPE_CATALOG,
  TIME_EVENT_TYPE_LABELS,
  TIME_EVENT_TYPES,
  durationMinutesFromTimes,
  type TimeEventType,
  type TimeEventTypeDefinition,
} from './time-event-type-catalog';

export type TimeEventTypeMetadataDto = {
  value: TimeEventType;
  label: string;
  category: TimeEventTypeDefinition['category'];
  dateMode: TimeEventTypeDefinition['dateMode'];
  timeMode: TimeEventTypeDefinition['timeMode'];
  supportsUnpaid: boolean;
  visualKind: TimeEventTypeDefinition['visualKind'];
  schedulePolicy: TimeEventTypeDefinition['schedulePolicy'];
};

/** Metadata for FE forms — derived only from TypeCatalog. */
export function buildTimeEventTypeMetadata(): TimeEventTypeMetadataDto[] {
  return TIME_EVENT_TYPES.map((value) => {
    const def = TIME_EVENT_TYPE_CATALOG[value];
    return {
      value,
      label: TIME_EVENT_TYPE_LABELS[value],
      category: def.category,
      dateMode: def.dateMode,
      timeMode: def.timeMode,
      supportsUnpaid: def.supportsUnpaid,
      visualKind: def.visualKind,
      schedulePolicy: def.schedulePolicy,
    };
  });
}

export function mapDurationMinutes(
  type: string,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): number | null {
  if (type !== 'overtime' && type !== 'part_time' && type !== 'extra_work_day') {
    return null;
  }
  return durationMinutesFromTimes(startTime, endTime);
}
