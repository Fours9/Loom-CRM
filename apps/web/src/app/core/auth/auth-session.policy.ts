/** Post-login and guest-landing destination from session flag only (not JWT payload). */
export function destinationAfterAuth(
  mustChangePassword: boolean,
): '/change-password' | '/' {
  return mustChangePassword ? '/change-password' : '/';
}

export function shellMustChangeRedirect(input: {
  authenticated: boolean;
  guestAllowed: boolean;
  mustChangePassword: boolean;
}): '/change-password' | null {
  if (input.guestAllowed) {
    return null;
  }
  if (input.authenticated && input.mustChangePassword) {
    return '/change-password';
  }
  return null;
}

export function guestLandingRedirect(input: {
  authenticated: boolean;
  mustChangePassword: boolean;
}): '/change-password' | '/' | null {
  if (!input.authenticated) {
    return null;
  }
  return destinationAfterAuth(input.mustChangePassword);
}

export function changePasswordPageRedirect(input: {
  authenticated: boolean;
  mustChangePassword: boolean;
}): '/login' | '/' | null {
  if (!input.authenticated) {
    return '/login';
  }
  if (!input.mustChangePassword) {
    return '/';
  }
  return null;
}

/** Canonical match: pathname ends with login or change-password auth endpoints. */
export function isAuthSessionExemptUrl(url: string): boolean {
  const path = authRequestPathname(url);
  return (
    path.endsWith('/auth/login') || path.endsWith('/auth/change-password')
  );
}

export function kickSessionOnUnauthorized(
  requestUrl: string,
  session: { logout(): void },
  router: { navigate(commands: string[]): unknown },
): void {
  if (isAuthSessionExemptUrl(requestUrl)) {
    return;
  }
  session.logout();
  void router.navigate(['/login']);
}

function authRequestPathname(url: string): string {
  try {
    return new URL(url, 'http://local.invalid').pathname;
  } catch {
    return (url.split('?')[0] ?? url).trim();
  }
}
