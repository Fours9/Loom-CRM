import { isDbBackedStorageKey } from './file-deletion-outbox';

describe('file-deletion-outbox helpers', () => {
  it('treats db: prefix as inline storage', () => {
    expect(isDbBackedStorageKey('db:employee-document-file:1')).toBe(true);
    expect(isDbBackedStorageKey('db:req:123')).toBe(true);
  });

  it('treats other keys as external', () => {
    expect(isDbBackedStorageKey('s3://bucket/key')).toBe(false);
    expect(isDbBackedStorageKey('uploads/a.pdf')).toBe(false);
  });
});
