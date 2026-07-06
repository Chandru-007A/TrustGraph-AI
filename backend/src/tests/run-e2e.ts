// src/tests/run-e2e.ts
// ─────────────────────────────────────────────────────────────────────────────
// E2E Test Runner Orchestrator
//
// Automatically manages database switching to SQLite, running tests,
// and restoring postgres config.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const backendDir = path.join(__dirname, '../..');
const schemaPath = path.join(backendDir, 'prisma/schema.prisma');
const schemaBakPath = path.join(backendDir, 'prisma/schema.prisma.bak');
const envPath = path.join(backendDir, '.env');
const envBakPath = path.join(backendDir, '.env.bak');
const devDbPath = path.join(backendDir, 'prisma/dev.db');

function runCommand(command: string) {
  console.log(`Running: ${command}`);
  execSync(command, { cwd: backendDir, stdio: 'inherit' });
}

async function start() {
  console.log('🔄 Preparing test database environment...');

  try {
    // 1. Back up files
    fs.copyFileSync(schemaPath, schemaBakPath);
    console.log('    ✓ Backed up schema.prisma');
    fs.copyFileSync(envPath, envBakPath);
    console.log('    ✓ Backed up .env');

    // 2. Read schema.prisma and rewrite for SQLite compatibility
    let schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Switch datasource provider from postgresql to sqlite
    schemaContent = schemaContent.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
    // Change URL variable to SQLite path
    schemaContent = schemaContent.replace(/url\s*=\s*env\("DATABASE_URL"\)/g, 'url = "file:./dev.db"');
    // Remove directUrl line if present
    schemaContent = schemaContent.replace(/directUrl\s*=\s*env\("DIRECT_URL"\)/g, '// directUrl removed for sqlite');
    // Strip out @db.Decimal(18, 6) tags
    schemaContent = schemaContent.replace(/@db\.Decimal\(\d+,\s*\d+\)/g, '');

    fs.writeFileSync(schemaPath, schemaContent, 'utf8');
    console.log('    ✓ Configured schema.prisma for SQLite.');

    // 3. Configure .env for SQLite
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(/^DATABASE_URL=.*$/m, 'DATABASE_URL="file:./dev.db"');
    envContent = envContent.replace(/^DIRECT_URL=.*$/m, 'DIRECT_URL="file:./dev.db"');
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('    ✓ Configured .env for SQLite.');

    // 4. Run prisma generate and push database tables
    console.log('\n🔄 Generating SQLite client & pushing schema...');
    runCommand('npx prisma generate');
    runCommand('npx prisma db push --accept-data-loss');

    // 5. Run the actual E2E test script
    console.log('\n🔄 Running the test suite...');
    runCommand('npx ts-node src/tests/end-to-end.test.ts');

  } catch (err: any) {
    console.error('\n❌ Error encountered during E2E orchestration:');
    console.error(err.message || err);
  } finally {
    // 6. Restore original files
    console.log('\n🔄 Restoring postgres environment config...');
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
    if (fs.existsSync(devDbPath)) {
      fs.unlinkSync(devDbPath);
      console.log('    ✓ Cleaned up dev.db');
    }

    // 7. Regenerate prisma client back to postgres
    console.log('\n🔄 Regenerating Prisma client for Postgres...');
    try {
      runCommand('npx prisma generate');
      console.log('    ✓ Environment successfully restored.');
    } catch (genErr: any) {
      console.error('    ❌ Failed to regenerate Prisma client:', genErr.message);
    }
  }
}

start();
