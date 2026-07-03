import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load env vars from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Zod schema validates every required env var at startup.
 * The process exits immediately with a clear error if any var is missing.
 * This prevents silent runtime failures in production.
 */
const envVarsSchema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'test']).default('development'),
  PORT: z.string().default('5000'),

  // Database
  DATABASE_URL: z.string().describe('Supabase / PostgreSQL connection string (pooled)'),
  DIRECT_URL: z.string().optional().describe('Supabase direct connection string (migrations)'),

  // CORS
  CORS_ORIGIN: z.string().default('*').describe('CORS allowed origin'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRATION_MINUTES: z.string().default('30'),
  JWT_REFRESH_EXPIRATION_DAYS: z.string().default('30'),
  JWT_RESET_PASSWORD_EXPIRATION_MINUTES: z.string().default('10'),

  // Cookie
  COOKIE_SECRET: z.string().optional().describe('Secret for signed cookies'),
});

const envVars = envVarsSchema.safeParse(process.env);

if (!envVars.success) {
  console.error('❌ Config validation error — check your .env file:');
  console.error(JSON.stringify(envVars.error.format(), null, 2));
  process.exit(1);
}

const config = {
  env: envVars.data.NODE_ENV,
  isProduction: envVars.data.NODE_ENV === 'production',
  port: parseInt(envVars.data.PORT, 10),

  db: {
    url: envVars.data.DATABASE_URL,
    directUrl: envVars.data.DIRECT_URL,
  },

  corsOrigin: envVars.data.CORS_ORIGIN,

  jwt: {
    secret: envVars.data.JWT_SECRET,
    accessExpirationMinutes: parseInt(envVars.data.JWT_ACCESS_EXPIRATION_MINUTES, 10),
    refreshExpirationDays: parseInt(envVars.data.JWT_REFRESH_EXPIRATION_DAYS, 10),
    resetPasswordExpirationMinutes: parseInt(envVars.data.JWT_RESET_PASSWORD_EXPIRATION_MINUTES, 10),
  },

  cookie: {
    secret: envVars.data.COOKIE_SECRET,
  },
};

export default config;
