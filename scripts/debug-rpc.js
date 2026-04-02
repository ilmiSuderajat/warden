const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.test', 'utf8').split('\n').reduce((acc, line) => {
    const [key, ...val] = line.split('=');
    if (key && val.length > 0) acc[key] = val.join('=');
    return acc;
}, {});
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(SUPABASE_URL, SERVICE_KEY);
(async () => {
    const { data: userData } = await client.auth.admin.getUserById(env.TEST_USER_ID_A);
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false }
    });
    const { data: signIn } = await userClient.auth.signInWithPassword({ email: userData.user.email, password: 'SeedTest@123!' });
    const authClient = createClient(SUPABASE_URL, SERVICE_KEY, {
        global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } }
    });
    
    console.log("Calling topup_wallet...");
    const res = await authClient.rpc('topup_wallet', { p_amount: 1500000 });
    console.log("Result:", JSON.stringify(res, null, 2));
})();
