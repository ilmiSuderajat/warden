import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const env = fs.readFileSync('.env.test', 'utf-8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if (k) acc[k.trim()] = v?.trim();
  return acc;
}, {} as any);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const ORDER_UNPAID = process.env.TEST_ORDER_ID_UNPAID || env.TEST_ORDER_ID_UNPAID;
const USER_A = process.env.TEST_USER_ID_A || env.TEST_USER_ID_A;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function main() {
  const { data: userData } = await admin.auth.admin.getUserById(USER_A);
  if (!userData?.user?.email) throw new Error("No user email found")
  
  const userSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: signIn } = await userSupabase.auth.signInWithPassword({
      email: userData.user.email,
      password: 'SeedTest@123!',
  });
  
  if (!signIn?.session?.access_token) throw new Error("SignIn failed, no session token")
  
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } }
  });

  const { data, error } = await userClient.rpc('process_payment', {
      p_order_id: ORDER_UNPAID,
      p_idempotency_key: `test-${Date.now()}`
  });
  console.log('Test process_payment:', { data, error });
}
main().catch(console.error);
