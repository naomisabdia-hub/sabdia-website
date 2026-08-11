// Read-only: where is this project's Supabase quota going? Walks every storage
// bucket recursively and counts every table row. Writes nothing.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const root = '/Users/naomidurcau/Desktop/New sabdia website'
function loadEnv() {
  const env = { ...process.env }
  for (const f of ['.env', '.env.local']) {
    let t; try { t = readFileSync(`${root}/${f}`, 'utf8') } catch { continue }
    for (const line of t.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}
const env = loadEnv()
const url = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL
const sb = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const MB = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`
console.log(`\nPROJECT ${url}\n`)

const { data: buckets, error: bE } = await sb.storage.listBuckets()
if (bE) console.log('bucket list error:', bE.message)
let grand = 0
const allFiles = []
for (const b of buckets || []) {
  let bytes = 0, files = 0
  const byFolder = {}
  const byExt = {}
  const walk = async (prefix, depth = 0) => {
    if (depth > 8) return
    let offset = 0
    for (;;) {
      const { data, error } = await sb.storage.from(b.name).list(prefix, { limit: 100, offset })
      if (error) { console.log('  err', prefix, error.message); return }
      if (!data?.length) return
      for (const o of data) {
        const path = prefix ? `${prefix}/${o.name}` : o.name
        if (o.id === null) { await walk(path, depth + 1); continue }
        const size = o.metadata?.size || 0
        bytes += size; files++
        const top = path.split('/').slice(0, 2).join('/')
        byFolder[top] = byFolder[top] || { n: 0, b: 0 }
        byFolder[top].n++; byFolder[top].b += size
        const ext = (o.name.split('.').pop() || '?').toLowerCase()
        byExt[ext] = byExt[ext] || { n: 0, b: 0 }
        byExt[ext].n++; byExt[ext].b += size
        allFiles.push({ bucket: b.name, path, size, created: o.created_at })
      }
      if (data.length < 100) return
      offset += 100
    }
  }
  await walk('')
  grand += bytes
  console.log(`BUCKET "${b.name}" (public:${b.public})  ${files} files  ${MB(bytes)}`)
  console.log('  by folder:')
  for (const [k, v] of Object.entries(byFolder).sort((a, c) => c[1].b - a[1].b).slice(0, 25))
    console.log(`    ${MB(v.b).padStart(10)}  ${String(v.n).padStart(5)} files  ${k}`)
  console.log('  by type:')
  for (const [k, v] of Object.entries(byExt).sort((a, c) => c[1].b - a[1].b).slice(0, 15))
    console.log(`    ${MB(v.b).padStart(10)}  ${String(v.n).padStart(5)} files  .${k}`)
  console.log()
}
console.log(`TOTAL FILE STORAGE: ${MB(grand)}  (${allFiles.length} files)\n`)
console.log('BIGGEST 25 FILES')
for (const f of allFiles.sort((a, b) => b.size - a.size).slice(0, 25))
  console.log(`  ${MB(f.size).padStart(10)}  ${f.path}`)

// duplicate-name detection (same basename + same size = likely dupe)
const seen = {}
let dupeBytes = 0, dupeN = 0
for (const f of allFiles) {
  const k = `${f.path.split('/').pop()}|${f.size}`
  if (seen[k]) { dupeBytes += f.size; dupeN++ } else seen[k] = f.path
}
console.log(`\nLIKELY DUPLICATES (same filename + size): ${dupeN} files, ${MB(dupeBytes)}`)

// ------------------------------------------------------------------ tables
console.log('\nTABLES')
const TABLES = ['posts', 'blog_posts', 'leads', 'inbox', 'messages', 'enquiries', 'properties', 'homes', 'projects', 'media', 'images', 'page_views', 'analytics', 'events', 'sessions', 'audit_log', 'logs', 'subscribers', 'content', 'settings']
for (const t of TABLES) {
  const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true })
  if (error) continue
  const { data } = await sb.from(t).select('*').limit(100)
  const avg = data?.length ? data.reduce((a, r) => a + Buffer.byteLength(JSON.stringify(r)), 0) / data.length : 0
  console.log(`  ${t.padEnd(16)} ${String(count).padStart(8)} rows  ${String(Math.round(avg)).padStart(7)} B avg  ${MB(avg * count).padStart(10)}`)
}
console.log()
