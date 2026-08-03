import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@devjuanes/matuclient';

const url = process.env.MATUDB_URL;
const projectId = process.env.MATUDB_PROJECT_ID;
const apiKey = process.env.MATUDB_API_KEY;

if (!url || !projectId || !apiKey) {
  console.error('Missing MATUDB_URL / MATUDB_PROJECT_ID / MATUDB_API_KEY');
  process.exit(1);
}

const db = createClient({
  url,
  projectId,
  apiKey,
  useSupabase: false,
});

const schemaPath = resolve('database/schema.sql');
const sql = readFileSync(schemaPath, 'utf8');

// Split on statements while keeping CREATE/ALTER blocks intact enough for Postgres.
const statements = sql
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith('--'));

console.log(`Applying ${statements.length} SQL statements to MatuDB…`);

for (const [i, statement] of statements.entries()) {
  const query = statement.endsWith(';') ? statement : `${statement};`;
  const { error } = await db.rpc(query);
  if (error) {
    console.error(`❌ [${i + 1}/${statements.length}] ${error.message}`);
    console.error(query.slice(0, 180));
    process.exit(1);
  }
  console.log(`✔ [${i + 1}/${statements.length}]`);
}

const probe = await db.from('profiles').select('id').limit(1);
if (probe.error) {
  console.error('Schema applied but profiles probe failed:', probe.error.message);
  process.exit(1);
}

console.log('MatuCall schema ready on MatuDB.');

// Incremental alters for existing projects
try {
  const migratePath = resolve('database/migrate_v2.sql');
  const migrateSql = readFileSync(migratePath, 'utf8');
  const migrateStatements = migrateSql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));
  console.log(`Applying ${migrateStatements.length} migrate_v2 statements…`);
  for (const [i, statement] of migrateStatements.entries()) {
    const query = statement.endsWith(';') ? statement : `${statement};`;
    const { error } = await db.rpc(query);
    if (error) {
      console.warn(`⚠ migrate [${i + 1}] ${error.message}`);
    } else {
      console.log(`✔ migrate [${i + 1}/${migrateStatements.length}]`);
    }
  }
} catch (err) {
  console.warn('migrate_v2 skipped:', err);
}
