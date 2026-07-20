import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const prerender = false;

/**
 * AI writing assistant for the admin portal (the Journal editor and friends).
 *
 * Dormant until ANTHROPIC_API_KEY is set in the environment. Every request
 * must carry the signed-in portal user's token; it is verified against
 * Supabase's is_admin_user() before any model call, so only portal members
 * can spend tokens.
 *
 * Tasks: draft | polish | tighten | meta | alt | headlines
 * The model only ever works from facts the editor supplies — the system
 * prompt forbids invention and requires [CHECK: …] placeholders for gaps.
 */

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const env = (key: string) => import.meta.env[key] ?? process.env[key];

const SYSTEM = `You are the in-house writing assistant for Sabdia Constructions — a boutique luxury home builder and developer in inner Brisbane, Queensland (est. 2013, 100+ residences, multi-award-winning). You help the team write for "The Sabdia Journal" (the website blog) and other site copy.

VOICE — editorial, confident, understated luxury:
- Write like a coffee-table book, not a brochure. Short declarative sentences. No exclamation marks.
- Confidence without boasting. Specifics are luxury: name the suburb, the stone, the light. Vague praise is cheap.
- Australian English always: colour, organise, enquiry, metres.
- Write the brand name in exact case: "Sabdia" or "SABDIA" — never lowercase.

FACTS — the hard rule:
- Use ONLY facts present in the material provided (notes, resources, current text). Never invent projects, awards, numbers, dates, quotes, or client names.
- Where a fact is needed but missing, write the placeholder [CHECK: what's needed] so the editor fills it in.

FORMATTING — Journal body fields use this exact markdown-lite syntax:
- Blank line between paragraphs · "## Heading" · "### Small heading" · "> pull quote" · "- bullet" · **bold** · *italic* · [link text](/path/).
- Structure for a full draft: hook (2–3 sentences) → ## The challenge → ## Sabdia's approach → ## Proof (a real residence, linked, e.g. [CASPIAN](/properties/caspian/)) → one > pull quote → ## closing invitation linking [start a conversation](/contact/).
- Sweet spot 500–800 words. One idea per paragraph, 2–4 sentences each.

Return ONLY the requested text — no preamble, no explanations, no code fences.`;

const TASKS: Record<string, (p: Record<string, string>) => string> = {
  draft: (p) => `Write a complete Journal entry draft.

Title (may be refined): ${p.title || '(untitled — propose one on the first line as "TITLE: …")'}
Category: ${p.category || '(suggest one)'}

Notes and resources from the editor — the ONLY source of facts:
"""
${p.notes || '(none provided — write the structure with [CHECK] placeholders throughout)'}
"""`,
  polish: (p) => `Polish this Journal body: keep the author's meaning, structure and facts exactly; lift the prose to the Sabdia voice; fix grammar and Australian English; keep the same markdown-lite formatting. Return the full polished body.

"""
${p.text}
"""${p.notes ? `\n\nAdditional context from the editor:\n"""\n${p.notes}\n"""` : ''}`,
  tighten: (p) => `Tighten this Journal body to roughly two-thirds of its length: cut repetition and filler, keep every fact and the markdown-lite structure. Return the full tightened body.

"""
${p.text}
"""`,
  meta: (p) => `Based on this Journal entry, produce its metadata. Respond with ONLY a JSON object, no code fences: {"excerpt": "...", "seo_title": "...", "seo_description": "...", "category": "...", "tags": ["...", "..."]}

- excerpt: 1–2 sentences that earn the click (also the Google description base)
- seo_title: under 60 characters, includes something a Brisbane luxury-home buyer might search
- seo_description: under 155 characters
- category: one of New Release, Behind the Build, Design Notes, Completed Homes, Buying & Building
- tags: 2–4 short keywords

Title: ${p.title}
Body:
"""
${p.text}
"""`,
  alt: (p) => `Write alt text for this image (attached): one sentence, under 125 characters, describing what is actually visible — architecture, materials, light, setting. No "image of"/"photo of". Context: this illustrates a Journal entry titled "${p.title || 'untitled'}".`,
  headlines: (p) => `Propose 5 Journal headlines for a Brisbane luxury builder, each on its own line with its category in brackets. Base them only on this material:
"""
${p.notes || p.text || 'General: the Sabdia approach — design, develop, construct in-house.'}
"""`,
};

async function callerIsAdmin(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const url = env('SUPABASE_URL');
  const anon = env('SUPABASE_ANON_KEY') ?? env('PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anon) return false;
  const resp = await fetch(`${url}/rest/v1/rpc/is_admin_user`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: auth, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!resp.ok) return false;
  return (await resp.json()) === true;
}

export const POST: APIRoute = async ({ request, url }) => {
  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return json({ error: 'The AI assistant is not activated yet — add ANTHROPIC_API_KEY to the environment (see HANDOVER.md).' }, 503);
  }

  if (!(await callerIsAdmin(request))) {
    return json({ error: 'Sign in to the admin portal to use the AI assistant.' }, 401);
  }

  const p = (await request.json()) as Record<string, string>;
  const build = TASKS[p.task];
  if (!build) return json({ error: `Unknown task "${p.task}"` }, 400);
  for (const k of ['text', 'notes', 'title', 'category']) p[k] = String(p[k] ?? '').slice(0, 30000);

  const content: Anthropic.ContentBlockParam[] = [{ type: 'text', text: build(p) }];

  // The alt task looks at the actual image via a small self-hosted variant.
  if (p.task === 'alt') {
    const src = String(p.image ?? '');
    const local = src.startsWith('/images/') || src.startsWith('/api/img');
    const remote = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//.test(src);
    if (!local && !remote) return json({ error: 'Set a hero image first, then ask for alt text.' }, 400);
    const publicHost = env('VERCEL_PROJECT_PRODUCTION_URL');
    const base = publicHost ? `https://${publicHost}` : url;
    const imgUrl = local
      ? new URL(`/api/img?src=${encodeURIComponent(src.startsWith('/api/img') ? new URL(src, url).searchParams.get('src')! : src)}&w=800&h=600`, base)
      : new URL(src);
    const resp = await fetch(imgUrl);
    if (!resp.ok) return json({ error: 'Could not load the hero image to describe it.' }, 400);
    const b64 = Buffer.from(await resp.arrayBuffer()).toString('base64');
    const mediaType = (resp.headers.get('content-type') ?? 'image/webp') as 'image/webp';
    content.unshift({ type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } });
  }

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) return json({ error: 'The assistant returned nothing — try rephrasing your notes.' }, 502);
    return json({ ok: true, text });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return json({ error: 'The AI key is invalid — check ANTHROPIC_API_KEY.' }, 503);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: 'The assistant is busy — try again in a minute.' }, 429);
    }
    if (error instanceof Anthropic.APIError) {
      console.error('AI assistant error:', error.status, error.message);
      return json({ error: 'The assistant hit a problem — try again shortly.' }, 502);
    }
    throw error;
  }
};
