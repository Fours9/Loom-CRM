import { HttpInterceptorFn } from '@angular/common/http';
import { ACCESS_TOKEN_KEY } from './session.store';

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const token =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(ACCESS_TOKEN_KEY)
      : null;
  if (!token) {
    return next(req);
  }
  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
