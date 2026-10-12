import { peopleDirectoryLoadErrorMessage } from './people-directory-load-error';

describe('peopleDirectoryLoadErrorMessage', () => {
  it('does not claim login required for network errors', () => {
    expect(peopleDirectoryLoadErrorMessage({ status: 0 })).toContain(
      'сервер недоступний',
    );
  });

  it('mentions login only for 401', () => {
    expect(peopleDirectoryLoadErrorMessage({ status: 401 })).toContain(
      'потрібен вхід',
    );
  });

  it('mentions access for 403', () => {
    expect(peopleDirectoryLoadErrorMessage({ status: 403 })).toContain(
      'немає доступу',
    );
  });

  it('mentions bad params for 400', () => {
    expect(peopleDirectoryLoadErrorMessage({ status: 400 })).toContain(
      'некоректні параметри',
    );
  });

  it('falls back without assuming login', () => {
    expect(peopleDirectoryLoadErrorMessage(new Error('x'))).toBe(
      'Не вдалося завантажити працівників',
    );
  });
});
