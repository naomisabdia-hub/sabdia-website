// Archive the superseded QASR scrollwalk versions to local disk BEFORE any of
// them are deleted from Supabase (Naomi 2026-08-11: "first download or export
// all the items we are deleting from v9-20, then focus on deleting once it's
// exported").
//
// Downloads every frame of every named version into
//   ~/Desktop/QASR scrollwalk archive/<version>/
// and writes manifest.json — the file list with byte sizes as they were in
// the bucket. That manifest is what the verify pass checks against, so
// "exported" means byte-for-byte confirmed, not just "the script finished".
//
// Resumable: a file already on disk at the right size is skipped, so a
// dropped connection costs you nothing. Read-only against Supabase.
//
//   node scripts/archive-scrollwalk.mjs               # download v9..v20
//   node scripts/archive-scrollwalk.mjs --verify      # re-check disk vs bucket
import { readFileSync, mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/naomidurcau/Desktop/New sabdia website'
const DEST = join(homedir(), 'Desktop', 'QASR scrollwalk archive')
const VERSIONS = Array.from({ length: 12 }, (_, i) => `qasr-v${i + 9}`) // v9..v20 (v21 is LIVE — never in this list)
const BUCKET = 'media'
const PREFIX = 'scrollwalk'
const VERIFY_ONLY = process.argv.includes('--verify')
const CONCURRENCY = 12

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
const URL_BASE = (env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL).replace(/\/$/, '')
const sb = createClient(URL_BASE, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const MB = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`

// ------------------------------------------------------------- list the bucket
async function listVersion(v) {
  const files = []
  const walk = async (prefix) => {
    let offset = 0
    for (;;) {
      const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 100, offset })
      if (error) throw new Error(`list ${prefix}: ${error.message}`)
      if (!data?.length) return
      for (const o of data) {
        const path = `${prefix}/${o.name}`
        if (o.id === null) { await walk(path); continue }
        files.push({ path, name: o.name, size: o.metadata?.size || 0 })
      }
      if (data.length < 100) return
      offset += 100
    }
  }
  await walk(`${PREFIX}/${v}`)
  return files
}

console.log(`\nQASR SCROLLWALK ARCHIVE  →  ${DEST}\n`)
console.log('  Reading the bucket…')
const plan = []
for (const v of VERSIONS) {
  const files = await listVersion(v)
  plan.push({ v, files, bytes: files.reduce((a, f) => a + f.size, 0) })
}
const totalFiles = plan.reduce((a, p) => a + p.files.length, 0)
const totalBytes = plan.reduce((a, p) => a + p.bytes, 0)
for (const p of plan) console.log(`    ${p.v.padEnd(10)} ${String(p.files.length).padStart(5)} files  ${MB(p.bytes).padStart(9)}`)
console.log(`    ${'TOTAL'.padEnd(10)} ${String(totalFiles).padStart(5)} files  ${MB(totalBytes).padStart(9)}\n`)

// ---------------------------------------------------------------- download
let done = 0, skipped = 0, failed = []
async function grab(v, f) {
  const out = join(DEST, v, f.name)
  if (existsSync(out) && statSync(out).size === f.size) { skipped++; done++; return }
  const url = `${URL_BASE}/storage/v1/object/public/${BUCKET}/${f.path}`
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (f.size && buf.length !== f.size) throw new Error(`size ${buf.length} != ${f.size}`)
      await writeFile(out, buf)
      done++
      return
    } catch (e) {
      if (attempt === 3) { failed.push({ path: f.path, err: String(e.message || e) }); done++; return }
      await new Promise((r) => setTimeout(r, 400 * attempt))
    }
  }
}

if (!VERIFY_ONLY) {
  for (const p of plan) {
    mkdirSync(join(DEST, p.v), { recursive: true })
    const queue = [...p.files]
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const f = queue.shift()
        if (!f) return
        await grab(p.v, f)
        if (done % 250 === 0) process.stdout.write(`\r  downloading… ${done}/${totalFiles}`)
      }
    })
    await Promise.all(workers)
    process.stdout.write(`\r  ${p.v.padEnd(10)} done (${p.files.length} files)          \n`)
  }
  console.log(`\n  downloaded ${done - skipped}, already had ${skipped}, failed ${failed.length}`)
}

// ------------------------------------------------------------------ verify
console.log('\nVERIFY — disk vs bucket, file by file')
let okN = 0, missing = [], wrongSize = []
for (const p of plan) {
  for (const f of p.files) {
    const out = join(DEST, p.v, f.name)
    if (!existsSync(out)) { missing.push(`${p.v}/${f.name}`); continue }
    const on = statSync(out).size
    if (f.size && on !== f.size) { wrongSize.push(`${p.v}/${f.name} (${on} vs ${f.size})`); continue }
    okN++
  }
}
const diskBytes = plan.reduce((a, p) => a + p.files.reduce((b, f) => {
  const out = join(DEST, p.v, f.name)
  return b + (existsSync(out) ? statSync(out).size : 0)
}, 0), 0)

mkdirSync(DEST, { recursive: true })
writeFileSync(join(DEST, 'manifest.json'), JSON.stringify({
  archived_at: new Date().toISOString(),
  source: `${URL_BASE} · bucket "${BUCKET}" · ${PREFIX}/`,
  note: 'Superseded QASR scrollwalk frame sequences. v21 is the live version and is NOT in this archive.',
  verified: missing.length === 0 && wrongSize.length === 0,
  totals: { files: totalFiles, bytes: totalBytes, on_disk_bytes: diskBytes },
  versions: plan.map((p) => ({ version: p.v, files: p.files.length, bytes: p.bytes, names: p.files.map((f) => f.name) })),
}, null, 1))

console.log(`  matched   ${okN}/${totalFiles} files`)
console.log(`  on disk   ${MB(diskBytes)}  (bucket: ${MB(totalBytes)})`)
if (missing.length) console.log(`  MISSING   ${missing.length}: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`)
if (wrongSize.length) console.log(`  WRONG SIZE ${wrongSize.length}: ${wrongSize.slice(0, 5).join(', ')}`)
if (failed.length) console.log(`  FAILED DOWNLOADS ${failed.length}: ${failed.slice(0, 5).map((f) => f.path).join(', ')}`)

const safe = missing.length === 0 && wrongSize.length === 0 && okN === totalFiles
console.log(`\n  ${safe ? '\x1b[32mVERIFIED — every file is on disk at the right size.\x1b[0m' : '\x1b[31mNOT VERIFIED — do not delete anything yet.\x1b[0m'}`)
console.log(`  manifest: ${join(DEST, 'manifest.json')}\n`)
process.exit(safe ? 0 : 1)
