import {
  changePasswordPageRedirect,
  destinationAfterAuth,
  guestLandingRedirect,
  isAuthSessionExemptUrl,
  kickSessionOnUnauthorized,
  shellMustChangeRedirect,
} from './auth-session.policy';

describe('destinationAfterAuth', () => {
  it('sends must-change users to /change-password', () => {
    expect(destinationAfterAuth(true)).toBe('/change-password');
  });

  it('sends others to the shell', () => {
    expect(destinationAfterAuth(false)).toBe('/');
  });
});

describe('mustChangePasswordGuard policy (shell)', () => {
  it('redirects authenticated must-change users', () => {
    expect(
      shellMustChangeRedirect({
        authenticated: true,
        guestAllowed: false,
        mustChangePassword: true,
      }),
    ).toBe('/change-password');
  });

  it('lets guests through', () => {
    expect(
      shellMustChangeRedirect({
        authenticated: false,
        guestAllowed: true,
        mustChangePassword: false,
      }),
    ).toBeNull();
  });

  it('lets authenticated users without the flag through', () => {
    expect(
      shellMustChangeRedirect({
        authenticated: true,
        guestAllowed: false,
        mustChangePassword: false,
      }),
    ).toBeNull();
  });
});

describe('guestGuard policy', () => {
  it('sends authenticated must-change users to /change-password', () => {
    expect(
      guestLandingRedirect({
        authenticated: true,
        mustChangePassword: true,
      }),
    ).toBe('/change-password');
  });

  it('sends authenticated users to shell', () => {
    expect(
      guestLandingRedirect({
        authenticated: true,
        mustChangePassword: false,
      }),
    ).toBe('/');
  });
});

describe('changePasswordPageGuard policy', () => {
  it('sends anonymous users to login', () => {
    expect(
      changePasswordPageRedirect({
        authenticated: false,
        mustChangePassword: false,
      }),
    ).toBe('/login');
  });

  it('sends users who already changed password to shell', () => {
    expect(
      changePasswordPageRedirect({
        authenticated: true,
        mustChangePassword: false,
      }),
    ).toBe('/');
  });
});

describe('401 interceptor policy', () => {
  it('logs out on /auth/me 401', () => {
    const logout = jest.fn();
    const navigate = jest.fn();
    kickSessionOnUnauthorized(
      'http://localhost:3000/api/v1/auth/me',
      { logout },
      { navigate },
    );
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('does not log out on /auth/change-password 401', () => {
    const logout = jest.fn();
    const navigate = jest.fn();
    kickSessionOnUnauthorized(
      '/api/v1/auth/change-password',
      { logout },
      { navigate },
    );
    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('treats login as exempt', () => {
    expect(isAuthSessionExemptUrl('http://x/api/v1/auth/login')).toBe(true);
  });
});
