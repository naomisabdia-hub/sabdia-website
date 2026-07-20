/**
 * Seed the Journal with two example DRAFT entries (never auto-published) so
 * the admin has a pattern to copy. Idempotent — skips slugs that exist.
 * Both drafts are written strictly from facts already published on the
 * site; review before publishing.
 *
 * Run AFTER supabase/blog.sql has been applied:  node scripts/seed-blog-posts.mjs
 */
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const envText = await readFile('.env', 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const posts = [
  {
    slug: 'inside-caspian-ascot',
    title: 'Inside CASPIAN: an Ascot address, designed from the street in',
    category: 'Behind the Build',
    excerpt:
      'Five bedrooms, five bathrooms, and a facade that introduces itself quietly. A walk through the thinking behind our current Ascot release.',
    hero_image: '/images/caspian-hero.jpg',
    hero_alt: 'CASPIAN — curved white render facade with timber battens at dusk, Ascot',
    author: 'Sabdia Constructions',
    tags: ['CASPIAN', 'Ascot', 'For Sale'],
    published: false,
    seo_title: 'Inside CASPIAN — luxury home for sale in Ascot | Sabdia Constructions',
    seo_description:
      'A look inside CASPIAN, Sabdia Constructions’ five-bedroom luxury residence for sale in Ascot, Brisbane — designed, developed and constructed in-house.',
    body: [
      'Some houses announce themselves. CASPIAN prefers to be discovered — a curved white form behind timber battens on an Ascot street, giving a little more of itself with every step toward the gate.',
      '## The brief we set ourselves',
      'Ascot is one of Brisbane’s most established addresses, and established addresses come with expectations. The house had to hold its own beside homes a century older without imitating them — contemporary, but with the calm of something that has always been there.',
      '## Design, develop, construct — one team',
      'CASPIAN, like every Sabdia residence, was designed, developed and constructed in-house. That means the person who drew the curve of the facade also answered for building it, and the details survived the journey from sketch to site: the arched openings, the stone garden wall, the battened screen that filters the western sun.',
      '## The numbers, briefly',
      '- Five bedrooms, five bathrooms\n- Three-car garage\n- Ascot, Queensland — currently for sale',
      '> The measure of a home is not how it photographs. It is how it feels to arrive at, every day, for years.',
      '## See it for yourself',
      'CASPIAN is offered for sale now. Explore [the full residence](/properties/caspian/), or [start a conversation](/contact/) about a private inspection.',
    ].join('\n\n'),
  },
  {
    slug: 'design-develop-construct-in-house',
    title: 'Design · Develop · Construct: what building in-house actually changes',
    category: 'Design Notes',
    excerpt:
      'Most builders build someone else’s drawings. At Sabdia, the designer, developer and constructor answer to each other — here’s what that changes for the home.',
    hero_image: '/images/home-hero-1.jpg',
    hero_alt: 'Open-plan Sabdia living space — stone kitchen island and dusk light through full-height glass',
    author: 'Sabdia Constructions',
    tags: ['In-house', 'Philosophy', 'Brisbane'],
    published: false,
    seo_title: 'Why Sabdia designs, develops and constructs in-house | Sabdia Constructions',
    seo_description:
      'What changes when one Brisbane team designs, develops and constructs every residence — accountability, detail, and homes that match their drawings.',
    body: [
      'There is a quiet gap in most building projects: the space between the person who imagined the home and the people who build it. Details fall into that gap. Ceiling heights get "value-engineered". The stone that anchored the whole scheme becomes a laminate "equivalent".',
      'Sabdia was structured so that gap cannot exist.',
      '## One name on every decision',
      'Design, development and construction sit inside one team. When a detail is drawn, it is drawn by people who know exactly what it costs and how it is built — so it survives. For over ten years and more than a hundred residences across inner Brisbane, that has been the difference between homes that resemble their renders and homes that match them.',
      '## What it means for a buyer',
      '- No hand-offs — the team that promised is the team that delivers\n- Decisions made for the decade, not the defect period\n- One conversation, from first sketch to key handover',
      '> Award-winning is a description. Accountable is a practice.',
      '## Where to see it',
      'Walk [the Collection](/collection/) — completed residences from MILOS to PETRA — or the homes [currently for sale](/properties/). Then [talk to us](/contact/) about yours.',
    ].join('\n\n'),
  },
];

let ok = 0;
for (const p of posts) {
  const { data: existing } = await supabase.from('blog_posts').select('id').eq('slug', p.slug).maybeSingle();
  if (existing) { console.log(`skip (exists): ${p.slug}`); continue; }
  const { error } = await supabase.from('blog_posts').insert(p);
  if (error) { console.error(`FAILED ${p.slug}: ${error.message}`); process.exitCode = 1; continue; }
  ok++;
  console.log(`seeded draft: ${p.slug}`);
}
console.log(`${ok} draft(s) seeded. They stay invisible until Published is ticked in /admin/blog.`);
