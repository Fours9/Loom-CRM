import { Injectable } from '@angular/core';
import { uk, UkDictionary } from './uk';

type DictPath = string;

@Injectable({ providedIn: 'root' })
export class TranslateService {
  private readonly dict: UkDictionary = uk;

  t(path: DictPath): string {
    const parts = path.split('.');
    let current: unknown = this.dict;
    for (const part of parts) {
      if (typeof current !== 'object' || current === null || !(part in current)) {
        return path;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return typeof current === 'string' ? current : path;
  }
}
