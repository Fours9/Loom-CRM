import { HttpErrorResponse } from '@angular/common/http';

export function isNetworkHttpError(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 0;
}
