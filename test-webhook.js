const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data: userData } = await supabase.from("users").select("id").limit(1).single();
  if (!userData) {
      console.log("No user found");
      return;
  }
  const userId = userData.id;

  const { error: updateErr } = await supabase.rpc('increment_wallet_balance', {
      p_user_id: userId,
      p_amount: 50000
  });
  console.log("updateErr:", updateErr);
  
  const { error: ledgerErr } = await supabase.rpc('create_transaction', {
      p_user_id: userId,
      p_order_id: null,
      p_type: 'topup',
      p_amount: 50000,
      p_description: `Topup Saldo Wallet test`
  });
  console.log("ledgerErr:", ledgerErr);
}
test().catch(console.error);
