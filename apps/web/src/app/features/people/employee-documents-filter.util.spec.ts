import { matchesDocumentTypeFilter } from './employee-documents-filter.util';

describe('matchesDocumentTypeFilter', () => {
  it('treats empty array as no type constraint (show all)', () => {
    expect(matchesDocumentTypeFilter([], 'employment')).toBe(true);
    expect(matchesDocumentTypeFilter([], 'time_event')).toBe(true);
  });

  it('matches inclusive OR when nonempty', () => {
    expect(
      matchesDocumentTypeFilter(['employment', 'medical'], 'employment'),
    ).toBe(true);
    expect(
      matchesDocumentTypeFilter(['employment', 'medical'], 'medical'),
    ).toBe(true);
    expect(
      matchesDocumentTypeFilter(['employment', 'medical'], 'identity'),
    ).toBe(false);
  });
});
