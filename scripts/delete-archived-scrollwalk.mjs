// Delete the superseded QASR scrollwalk versions from Supabase — but ONLY the
// files that are provably sitting on disk in the local archive first.
//
// The safety is structural, not a promise: this script deletes nothing it
// cannot find in ~/Desktop/QASR scrollwalk archive/ at a matching byte size,
// and it hard-refuses to touch qasr-v21 (the live version on the QASR
// property page) even if something upstream asked it to.
//
//   node scripts/delete-archived-scrollwalk.mjs --dry-run   # show, touch nothing
//   node scripts/delete-archived-scrollwalk.mjs --confirm   # actually delete
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/naomidurcau/Desktop/New sabdia website'
const ARCHIVE = join(homedir(), 'Desktop', 'QASR scrollwalk archive')
const BUCKET = 'media'
const LIVE = 'qasr-v21' // never delete — rendered by src/pages/properties/[slug].astro
const CONFIRM = process.argv.includes('--confirm')

function loadEnv() {
  const env = { ...process.env }
  for (const f of ['.env', '.env.local']) {
    let t; try { t = readFileSync(join(ROOT, f), 'utf8') } catch { continue }
    for (const line of t.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}
const env = loadEnv()
const sb = createClient(env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const MB = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`

const manifestPath = join(ARCHIVE, 'manifest.json')
if (!existsSync(manifestPath)) { console.error(`No archive manifest at ${manifestPath} — run archive-scrollwalk.mjs first.`); process.exit(1) }
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (!manifest.verified) { console.error('Archive manifest says NOT verified — refusing to delete.'); process.exit(1) }

console.log(`\nDELETE SUPERSEDED SCROLLWALK VERSIONS${CONFIRM ? '' : '  (dry run)'}\n`)

// Re-check every single file against disk, now, rather than trusting the
// manifest's own verdict — the archive could have been moved since.
const toDelete = []
let guarded = 0, notArchived = 0, bytes = 0
for (const v of manifest.versions) {
  if (v.version === LIVE || !/^qasr-v(9|1[0-9]|20)$/.test(v.version)) { guarded += v.files; continue }
  let ok = 0
  for (const name of v.names) {
    const local = join(ARCHIVE, v.version, name)
    if (!existsSync(local) || statSync(local).size === 0) { notArchived++; continue }
    toDelete.push(`scrollwalk/${v.version}/${name}`)
    ok++
  }
  bytes += v.bytes
  console.log(`  ${v.version.padEnd(10)} ${String(ok).padStart(5)}/${String(v.files).padEnd(5)} archived  ${MB(v.bytes).padStart(9)}`)
}
if (guarded) console.log(`  (${guarded} files in guarded/live versions were never considered)`)
if (notArchived) { console.error(`\n  ${notArchived} files are NOT in the local archive — refusing to delete anything.`); process.exit(1) }

console.log(`\n  ${toDelete.length} files, ${MB(bytes)} to remove from bucket "${BUCKET}"`)
console.log(`  ${LIVE} is untouched.\n`)

if (!CONFIRM) { console.log('  Dry run — nothing deleted. Re-run with --confirm.\n'); process.exit(0) }

let removed = 0
for (let i = 0; i < toDelete.length; i += 200) {
  const batch = toDelete.slice(i, i + 200)
  const { error } = await sb.storage.from(BUCKET).remove(batch)
  if (error) { console.error(`  batch at ${i} failed: ${error.message}`); continue }
  removed += batch.length
  process.stdout.write(`\r  deleted ${removed}/${toDelete.length}`)
}
console.log(`\n\n  Removed ${removed} files (${MB(bytes)}).`)
console.log(`  Local archive kept at: ${ARCHIVE}\n`)
