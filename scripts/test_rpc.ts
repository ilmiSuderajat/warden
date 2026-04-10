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
  // Get a random user
  const { data: users } = await supabase.from('users').select('id').eq('role', 'user').limit(1);
  const { data: drivers } = await supabase.from('users').select('id').eq('role', 'driver').limit(1);
  const { data: shops } = await supabase.from('shops').select('id').limit(1);
  
  if (!users?.length || !drivers?.length || !shops?.length) return console.log("Missing test data");
  
  const userId = users[0].id;
  const driverId = drivers[0].id;
  const shopId = shops[0].id;
  
  // Create order
  const { data: order, error: orderErr } = await supabase.from('orders').insert({
    user_id: userId,
    customer_name: 'test',
    address: 'test',
    whatsapp_number: '123',
    total_amount: 15000,
    shipping_amount: 5000,
    subtotal_amount: 10000,
    status: 'Selesai',
    driver_id: driverId
  }).select('id').single();
  
  if (orderErr) return console.log("order err", orderErr);
  
  // Create item
  await supabase.from('order_items').insert({
    order_id: order.id,
    product_name: `Dummy Product | ${shopId}`,
    quantity: 1,
    price: 10000
  });
  
  console.log("Calling create_transaction");
  const { error } = await supabase.rpc('create_transaction', { p_user_id: userId, p_order_id: order.id, p_type: 'commission', p_amount: 1000, p_description: 'test' });
  console.log("RPC Error result:", error);
}

run();
