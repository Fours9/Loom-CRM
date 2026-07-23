import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

@Component({
  selector: 'loom-placeholder-page',
  standalone: true,
  template: `
    <section class="page">
      <header class="page-head">
        <h1>{{ title() }}</h1>
        <p>{{ note() }}</p>
      </header>
    </section>
  `,
  styles: [
    `
      .page {
        display: grid;
        gap: 0.5rem;
        max-width: 40rem;
      }
      .page-head h1 {
        margin: 0;
        font-size: 1.75rem;
        color: var(--pw-text-strong);
      }
      .page-head p {
        margin: 0.35rem 0 0;
        color: var(--pw-muted);
        line-height: 1.5;
      }
    `,
  ],
})
export class PlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);
  readonly title = toSignal(
    this.route.data.pipe(map((d) => (d['title'] as string) || 'Розділ')),
    { initialValue: 'Розділ' },
  );
  readonly note = toSignal(
    this.route.data.pipe(map((d) => (d['note'] as string) || '')),
    { initialValue: '' },
  );
}
