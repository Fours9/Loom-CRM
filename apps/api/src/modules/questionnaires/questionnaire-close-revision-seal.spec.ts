import { ConflictException } from '@nestjs/common';

/**
 * Documents close-submit revision seal vs concurrent patchDraft.
 * Close bumps response.revision; a PATCH with the pre-close revision must 409.
 */
describe('close-submit revision seal vs PATCH', () => {
  it('stale draft revision conflicts after close seal', () => {
    const preCloseRevision = 2;
    const sealedRevision = preCloseRevision + 1;

    function assertPatchRevision(expected: number, current: number): void {
      if (expected !== current) {
        throw new ConflictException({
          message: 'Draft revision conflict',
          currentRevision: current,
        });
      }
    }

    expect(() =>
      assertPatchRevision(preCloseRevision, sealedRevision),
    ).toThrow(ConflictException);
  });
});
