import { formatIncompleteSections } from './profile-completeness-labels';

describe('formatIncompleteSections', () => {
  it('formats core gaps', () => {
    expect(formatIncompleteSections(['identity', 'assignment'], 'core')).toBe(
      'кадрові розділи: identity, assignment',
    );
  });

  it('formats extended gaps without mandatory wording', () => {
    const text = formatIncompleteSections(['photo', 'emergency'], 'extended');
    expect(text).toContain('добровільні');
    expect(text.toLowerCase()).not.toContain('обов');
  });

  it('returns empty string when nothing incomplete', () => {
    expect(formatIncompleteSections([], 'extended')).toBe('');
  });
});
