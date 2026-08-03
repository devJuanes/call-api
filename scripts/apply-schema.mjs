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

function splitSql(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))
    .map((s) => s.replace(/;+\s*$/, ''));
}

async function runFile(label, filePath, { fatal = true } = {}) {
  const sql = readFileSync(filePath, 'utf8');
  const statements = splitSql(sql);
  console.log(`Applying ${statements.length} ${label} statements…`);
  for (const [i, statement] of statements.entries()) {
    const { error } = await db.rpc(statement);
    if (error) {
      const msg = `⚠ [${i + 1}/${statements.length}] ${error.message}`;
      if (fatal) {
        console.error(`❌ [${i + 1}/${statements.length}] ${error.message}`);
        console.error(statement.slice(0, 180));
        process.exit(1);
      }
      console.warn(msg);
    } else {
      console.log(`✔ [${i + 1}/${statements.length}]`);
    }
  }
}

await runFile('schema', resolve('database/schema.sql'), { fatal: true });

const probeProfiles = await db.from('profiles').select('id').limit(1);
if (probeProfiles.error) {
  console.error('Schema applied but profiles probe failed:', probeProfiles.error.message);
  process.exit(1);
}
console.log('MatuCall schema ready on MatuDB.');

await runFile('migrate_v2', resolve('database/migrate_v2.sql'), { fatal: false });

const probeMeetings = await db
  .from('meetings')
  .select('id,waiting_room_enabled,is_locked,invite_url')
  .limit(1);
if (probeMeetings.error) {
  console.error(
    'migrate_v2 applied but meetings columns missing:',
    probeMeetings.error.message,
  );
  process.exit(1);
}
console.log('✔ meetings waiting_room / lock / invite_url ready');
