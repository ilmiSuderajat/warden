import './env-setup.ts'
import { Client } from 'pg'

async function debug() {
    const client = new Client({
        connectionString: process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('http://127.0.0.1:54321', 'postgresql://postgres:postgres@127.0.0.1:54322/postgres') || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
    })
    await client.connect()

    const trg = await client.query(`
        SELECT tgname, pg_get_triggerdef(pg_trigger.oid) as def
        FROM pg_trigger 
        JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
        WHERE relname = 'transactions'
    `)
    console.log("\ntransactions triggers:\n", trg.rows)

    await client.end()
}
debug().catch(console.error)
