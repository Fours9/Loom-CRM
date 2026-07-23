import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from './translate.service';

@Pipe({ name: 't', standalone: true })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(TranslateService);

  transform(path: string): string {
    return this.i18n.t(path);
  }
}
