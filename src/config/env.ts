import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV:            z.enum(['development', 'production', 'test']).default('development'),
  PORT:                z.string().default('3000').transform(Number),

  DB_HOST:             z.string().min(1, 'DB_HOST is required'),
  DB_PORT:             z.string().default('3306').transform(Number),
  DB_USER:             z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD:         z.string().min(1, 'DB_PASSWORD is required'),
  DB_NAME:             z.string().min(1, 'DB_NAME is required'),
  DB_CONNECTION_LIMIT: z.string().default('10').transform(Number),

  JWT_SECRET:          z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN:      z.string().default('8h'),
  BCRYPT_ROUNDS:       z.string().default('12').transform(Number),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:\n');
  parsed.error.issues.forEach((issue) => {
    console.error(`   ${issue.path.join('.')} — ${issue.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
