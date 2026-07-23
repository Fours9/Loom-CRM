import { getApplicationConfig } from './application-config';

describe('getApplicationConfig', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('requires DATABASE_URL and JWT_SECRET', () => {
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    expect(() => getApplicationConfig()).toThrow(/DATABASE_URL/);
  });

  it('parses port and cors', () => {
    process.env.DATABASE_URL = 'postgres://u:p@localhost:5432/db';
    process.env.JWT_SECRET = 'secret';
    process.env.PORT = '4000';
    process.env.CORS_ORIGIN = 'http://a,http://b';
    const cfg = getApplicationConfig();
    expect(cfg.port).toBe(4000);
    expect(cfg.corsOrigin).toEqual(['http://a', 'http://b']);
  });
});
