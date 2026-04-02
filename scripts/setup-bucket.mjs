import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ryxyjezyqspqlnikzyxz.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5eHlqZXp5cXNwcWxuaWt6eXh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkxOTEwMywiZXhwIjoyMDg3NDk1MTAzfQ.arc4yNRP-dDnPI3ZfX9NCdOtsSPPFzqLkrrDLOO-XnA'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function setup() {
    const { data, error } = await supabase.storage.createBucket('shop-images', { public: true })
    if (error) {
        console.error('Error creating bucket:', error.message)
    } else {
        console.log('Successfully created bucket shop-images!')
    }
}

setup()
