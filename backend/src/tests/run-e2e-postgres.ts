// src/tests/run-e2e-postgres.ts
// ─────────────────────────────────────────────────────────────────────────────
// E2E Test Runner — Postgres Test-Database variant.
//
// Mirrors the backup/restore pattern of run-e2e.ts but, instead of rewriting
// the Prisma schema for SQLite, creates a fresh throwaway Postgres database
// on the existing Supabase cluster, runs the E2E test, and drops the database
// at the end. This preserves all enum/array/Json types in the production
// schema (which the application code uses via @prisma/client).
//
// Usage:  npx ts-node src/tests/run-e2e-postgres.ts
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const backendDir = path.join(__dirname, '../..');
const schemaPath = path.join(backendDir, 'prisma/schema.prisma');
const schemaBakPath = path.join(backendDir, 'prisma/schema.prisma.bak');
const envPath = path.join(backendDir, '.env');
const envBakPath = path.join(backendDir, '.env.bak');

const TEST_DB_NAME = `leo_test_e2e_${Date.now()}`;

function runCommand(command: string, env?: NodeJS.ProcessEnv) {
  console.log(`\n$ ${command}`);
  execSync(command, { cwd: backendDir, stdio: 'inherit', env: { ...process.env, ...env } });
}

function readEnv(): Record<string, string> {
  const text = fs.readFileSync(envPath, 'utf8');
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/**
 * Build a copy of the given connection URL pointing at `dbName` instead of
 * its original database segment. Preserves credentials, host, port, query.
 */
function withDbName(originalUrl: string, dbName: string): string {
  // Match the database segment between the last "/" before "?" and the "?"
  // or end-of-string.
  const queryIdx = originalUrl.indexOf('?');
  const query = queryIdx >= 0 ? originalUrl.slice(queryIdx) : '';
  const base = queryIdx >= 0 ? originalUrl.slice(0, queryIdx) : originalUrl;
  // Strip any existing db segment
  const lastSlash = base.lastIndexOf('/');
  const prefix = base.slice(0, lastSlash + 1);
  return `${prefix}${dbName}${query}`;
}

async function start() {
  console.log('🔄 Preparing Postgres test-database environment...');
  console.log(`   Test database will be: ${TEST_DB_NAME}`);

  let testDbCreated = false;

  try {
    // 1. Back up .env and schema.prisma (same pattern as run-e2e.ts)
    fs.copyFileSync(schemaPath, schemaBakPath);
    console.log('    ✓ Backed up schema.prisma');
    fs.copyFileSync(envPath, envBakPath);
    console.log('    ✓ Backed up .env');

    // 2. Read original URLs
    const originalEnv = readEnv();
    const originalDirect = originalEnv.DIRECT_URL;
    if (!originalDirect) {
      throw new Error('DIRECT_URL is not set in .env — required for CREATE DATABASE.');
    }
    const originalDbUrl = originalEnv.DATABASE_URL;
    if (!originalDbUrl) {
      throw new Error('DATABASE_URL is not set in .env.');
    }

    // 3. CREATE DATABASE via prisma db execute using the direct URL.
    //    Use execSync with `input` so we can pipe the SQL in.
    console.log(`\n🔄 Creating test database ${TEST_DB_NAME}...`);
    execSync(
      `npx prisma db execute --url "${originalDirect}" --stdin`,
      {
        cwd: backendDir,
        stdio: ['pipe', 'inherit', 'inherit'],
        input: `CREATE DATABASE "${TEST_DB_NAME}";\n`,
      },
    );
    testDbCreated = true;
    console.log(`    ✓ Test database ${TEST_DB_NAME} created.`);

    // 4. Rewrite .env so DATABASE_URL and DIRECT_URL point at the test DB
    const newDbUrl = withDbName(originalDbUrl, TEST_DB_NAME);
    const newDirectUrl = withDbName(originalDirect, TEST_DB_NAME);
    let envText = fs.readFileSync(envPath, 'utf8');
    envText = envText.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${newDbUrl}`);
    envText = envText.replace(/^DIRECT_URL=.*$/m, `DIRECT_URL=${newDirectUrl}`);
    fs.writeFileSync(envPath, envText, 'utf8');
    console.log('    ✓ .env updated to point at test database.');

    // 5. Push schema to test DB
    console.log('\n🔄 Pushing schema to test database...');
    runCommand('npx prisma db push --accept-data-loss --skip-generate');

    // 6. Regenerate Prisma client so the new connection URL is honored
    runCommand('npx prisma generate');

    // 7. Run the E2E test
    console.log('\n🔄 Running the 10-step E2E test suite...');
    let testFailed = false;
    try {
      runCommand('npx ts-node src/tests/end-to-end.test.ts');
    } catch (err) {
      testFailed = true;
      console.error('    ❌ E2E test exited with non-zero status.');
    }

    // 8. Report per-step result by re-parsing captured stdout would require
    //    capturing stdout; the `run-e2e.ts` style relies on the test
    //    printing each step. The `inherit` stdio lets us show output live.
    //    We rely on the test's own exit code as the verdict.
    if (testFailed) {
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error('\n❌ Error during E2E orchestration:');
    console.error(err.message || err);
    process.exitCode = 1;
  } finally {
    // 9. Drop the test database (if it was created)
    if (testDbCreated) {
      try {
        // Re-read .env to recover the original DIRECT_URL (we may have
        // already restored it below, but try original first; on failure
        // fall back to the bak file).
        let directForDrop = '';
        if (fs.existsSync(envBakPath)) {
          const bak = fs.readFileSync(envBakPath, 'utf8');
          const m = bak.match(/^DIRECT_URL=(.*)$/m);
          if (m) directForDrop = m[1].trim();
        }
        if (!directForDrop) {
          // Already restored; use what's in .env now (which is the original).
          const cur = readEnv();
          directForDrop = cur.DIRECT_URL || '';
        }
        // Drop via direct URL by first force-disconnecting any leftover
        // sessions on the test DB. We use a transaction-mode-safe approach:
        // terminate connections, then drop.
        console.log(`\n🔄 Dropping test database ${TEST_DB_NAME}...`);
        const dropSql =
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity ` +
          `WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid();\n` +
          `DROP DATABASE IF EXISTS "${TEST_DB_NAME}";\n`;
        execSync(
          `npx prisma db execute --url "${directForDrop}" --stdin`,
          {
            cwd: backendDir,
            stdio: ['pipe', 'inherit', 'inherit'],
            input: dropSql,
          },
        );
        console.log(`    ✓ Test database ${TEST_DB_NAME} dropped.`);
      } catch (dropErr: any) {
        console.error(`    ⚠️  Failed to drop test database: ${dropErr.message || dropErr}`);
        console.error(`        You may need to drop it manually: DROP DATABASE ${TEST_DB_NAME};`);
      }
    }

    // 10. Restore original .env and schema.prisma
    console.log('\n🔄 Restoring original .env and schema.prisma...');
    if (fs.existsSync(schemaBakPath)) {
      fs.copyFileSync(schemaBakPath, schemaPath);
      fs.unlinkSync(schemaBakPath);
      console.log('    ✓ Restored schema.prisma');
    }
    if (fs.existsSync(envBakPath)) {
      fs.copyFileSync(envBakPath, envPath);
      fs.unlinkSync(envBakPath);
      console.log('    ✓ Restored .env');
    }

    // 11. Regenerate Prisma client for the original Postgres config
    try {
      runCommand('npx prisma generate');
      console.log('    ✓ Prisma client regenerated against original Postgres.');
    } catch (genErr: any) {
      console.error('    ❌ Failed to regenerate Prisma client:', genErr.message);
    }
  }
}

start();
