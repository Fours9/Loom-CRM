import { Injectable } from '@nestjs/common';

export type DateOnly = string;

@Injectable()
export class BusinessDateClock {
  today(): DateOnly {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Kyiv',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  now(): Date {
    return new Date();
  }
}
