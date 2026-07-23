export type ApplicationConfig = {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  corsOrigin: string | string[];
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function getApplicationConfig(): ApplicationConfig {
  const corsRaw = process.env.CORS_ORIGIN?.trim() || 'http://localhost:4200';
  const corsOrigin = corsRaw.includes(',')
    ? corsRaw.split(',').map((s) => s.trim())
    : corsRaw;

  return {
    nodeEnv: process.env.NODE_ENV?.trim() || 'development',
    port: Number(process.env.PORT || '3000'),
    databaseUrl: requireEnv('DATABASE_URL'),
    jwtSecret: requireEnv('JWT_SECRET'),
    corsOrigin,
  };
}
