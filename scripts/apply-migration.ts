import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Mock environment setup if needed
const envs = ['.env.local', '.env.test', '.env']
for (const env of envs) {
    const envPath = path.join(process.cwd(), env)
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n')
        for (const line of lines) {
            const [key, ...vals] = line.trim().split('=')
            if (key && vals.length > 0) process.env[key] = vals.join('=').replace(/^['"]|['"]$/g, '')
        }
    }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function applyMigration(filePath: string) {
    console.log(`Applying migration: ${filePath}`)
    const sql = fs.readFileSync(filePath, 'utf8')
    
    // Note: Supabase JS client doesn't have a direct 'sql' execution method.
    // We usually have to use an RPC 'exec_sql' if we've created one, 
    // or use the Supabase CLI.
    // If neither is available, we might need the user to run it in the dashboard.
    
    // Check if exec_sql RPC exists
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })
    
    if (error) {
        console.error("Error applying migration via RPC:", error)
        console.log("\nTIP: If the 'exec_sql' function does not exist, please run the SQL manually in the Supabase SQL Editor:")
        console.log("--------------------------------------------------")
        console.log(sql)
        console.log("--------------------------------------------------")
        process.exit(1)
    } else {
        console.log("Migration applied successfully!")
        process.exit(0)
    }
}

const migrationFile = process.argv[2]
if (!migrationFile) {
    console.error("Please specify a migration file path.")
    process.exit(1)
}

applyMigration(path.resolve(migrationFile)).catch(console.error)
