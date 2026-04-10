import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnvLocal();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  // Try to query pg_class for rules to find out if there's any rules on transactions that use "balance" instead of "balance_after".
  // Since we don't have exec_sql, we need another way to debug.
  // Let's insert directly into transactions via REST API and see if that succeeds
  
  const fakeId = '00000000-0000-0000-0000-000000000000';
  
  const { data: users } = await supabase.from('users').select('id').limit(1);
  if (!users?.length) return console.log("No users");
  
  console.log("Testing insert to wallets...");
  const w = await supabase.from('wallets').upsert({ user_id: users[0].id, balance: 1000 });
  console.log("Wallet insert:", w.error);
  
  console.log("Testing direct INSERT into transactions...");
  const t = await supabase.from('transactions').insert({
    user_id: users[0].id,
    type: 'topup',
    amount: 100,
    balance_after: 1100,
    prev_hash: 'abc',
    hash: 'def'
  });
  console.log("Transaction insert:", t.error);
}
run();
