import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { getDataSourceOptions } from './typeorm-options';

loadEnv({ path: resolve(__dirname, '../../../../.env') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(process.cwd(), '../../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for migrations');
}

export default new DataSource(getDataSourceOptions());
