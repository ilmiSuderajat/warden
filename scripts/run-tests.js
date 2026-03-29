const { execSync } = require('child_process');
const fs = require('fs');

// Load env vars
const envContents = fs.readFileSync('.env.test', 'utf8');
envContents.split('\n').forEach(line => {
  if (line.includes('=') && !line.startsWith('#')) {
    const [k, v] = line.split('=');
    process.env[k] = v.trim();
  }
});

try {
  const output = execSync('npx tsx scripts/simulate-attacks-patched.ts', { encoding: 'utf8', stdio: 'pipe' });
  fs.writeFileSync('scripts/test-output.log', output, 'utf8');
} catch (error) {
  fs.writeFileSync('scripts/test-output.log', error.stdout + '\n' + error.stderr, 'utf8');
}
console.log("Done");
