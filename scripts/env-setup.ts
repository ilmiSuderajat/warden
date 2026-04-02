import * as fs from 'fs'
import * as path from 'path'

function loadEnvFile(filename: string) {
    const envPath = path.join(process.cwd(), filename)
    if (!fs.existsSync(envPath)) return false
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const val = trimmed.slice(eqIdx + 1).trim()
        process.env[key] = val.replace(/^['"]|['"]$/g, '')
    }
    return true
}

loadEnvFile('.env.local')
loadEnvFile('.env.test')

console.log("✅ Environment loaded.")
