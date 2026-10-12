/** Single entry for People directory load failures — do not assume 401. */
export function peopleDirectoryLoadErrorMessage(err: unknown): string {
  const status =
    err && typeof err === 'object' && 'status' in err
      ? Number((err as { status: unknown }).status)
      : NaN;

  if (status === 0) {
    return 'Не вдалося завантажити працівників (сервер недоступний)';
  }
  if (status === 401) {
    return 'Не вдалося завантажити працівників (потрібен вхід)';
  }
  if (status === 403) {
    return 'Не вдалося завантажити працівників (немає доступу)';
  }
  if (status === 400) {
    return 'Не вдалося завантажити працівників (некоректні параметри)';
  }
  if (status >= 500) {
    return 'Не вдалося завантажити працівників (помилка сервера)';
  }
  return 'Не вдалося завантажити працівників';
}
