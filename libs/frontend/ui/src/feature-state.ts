export type FeatureStateKind =
  | 'loading'
  | 'loaded'
  | 'empty'
  | 'forbidden'
  | 'not-found'
  | 'error';

export type FeatureState<T = unknown> =
  | { kind: 'loading' }
  | { kind: 'loaded'; data: T }
  | { kind: 'empty' }
  | { kind: 'forbidden'; message?: string }
  | { kind: 'not-found'; message?: string }
  | { kind: 'error'; message?: string };

export function featureStateFromHttp<T = unknown>(
  status: number,
  fallback?: string,
): FeatureState<T> {
  if (status === 403) {
    return { kind: 'forbidden', message: fallback ?? 'Немає доступу' };
  }
  if (status === 404) {
    return { kind: 'not-found', message: fallback ?? 'Не знайдено' };
  }
  return { kind: 'error', message: fallback ?? 'Сталася помилка' };
}
