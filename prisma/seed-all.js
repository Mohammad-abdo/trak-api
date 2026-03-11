import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const seeds = [
  { file: 'seed-staff.js', label: 'Staff roles & permissions' },
  { file: 'seed-motorcycles.js', label: 'Motorcycle & scooter categories' },
  { file: 'seed-admin-notifications.js', label: 'Admin notifications' },
]

console.log('═══════════════════════════════════════════════')
console.log('  🌱  Running ALL seed scripts')
console.log('═══════════════════════════════════════════════\n')

let passed = 0
let failed = 0

for (const seed of seeds) {
  const filePath = path.join(__dirname, seed.file)
  console.log(`\n── [${passed + failed + 1}/${seeds.length}] ${seed.label} ──`)
  try {
    execSync(`node "${filePath}"`, { stdio: 'inherit', cwd: path.join(__dirname, '..') })
    passed++
  } catch (err) {
    console.error(`❌ Failed: ${seed.file}`)
    failed++
  }
}

console.log('\n═══════════════════════════════════════════════')
console.log(`  ✅ Passed: ${passed}  |  ❌ Failed: ${failed}`)
console.log('═══════════════════════════════════════════════\n')

if (failed > 0) process.exit(1)
