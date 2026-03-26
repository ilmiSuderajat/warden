import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const SUPABASE_URL = 'https://ryxyjezyqspqlnikzyxz.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5eHlqZXp5cXNwcWxuaWt6eXh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkxOTEwMywiZXhwIjoyMDg3NDk1MTAzfQ.arc4yNRP-dDnPI3ZfX9NCdOtsSPPFzqLkrrDLOO-XnA'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function testUpload() {
    // Create a dummy file
    fs.writeFileSync('dummy.txt', 'Hello World')
    const fileContent = fs.readFileSync('dummy.txt')

    console.log("Testing upload to shop-images...")
    const { data, error } = await supabase.storage
        .from('shop-images')
        .upload('test.txt', fileContent, { upsert: true, contentType: 'text/plain' })

    if (error) {
        console.error('Upload failed:', error)
    } else {
        console.log('Upload success:', data)
    }
}

testUpload()
