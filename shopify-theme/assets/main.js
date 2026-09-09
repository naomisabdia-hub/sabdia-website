/* ============================================================
   SABDIA CONSTRUCTIONS — MAIN JS (v4)

   Runs under Astro's ClientRouter. On a client-side navigation the
   document survives and <body> is replaced, which splits everything
   here into two scopes:

     · ONE-TIME — bound to document/window. This file is fetched once
       and never re-executed (Astro dedupes by src), so anything at
       module top level registers exactly once and lives for the whole
       session. Such handlers must look elements up at event time and
       never close over them, or they hold references to the previous
       page's DOM.

     · PER PAGE — bound to elements inside <body>. Re-run on every
       astro:page-load, which also fires on the very first load, so it
       is the single entry point rather than a special case.

   Anything with a lifetime — intervals, observers, rAF loops — is
   tracked and torn down before the next page wires up. Miss one and
   you get an extra copy per navigation: two slideshow timers fighting
   over the same hero, three scroll handlers, and so on.
   ============================================================ */

/* Belt and braces. Astro is expected to run this file once and skip it on
   subsequent swaps, but that is a behaviour of the router rather than a
   guarantee we control. If it ever did re-execute, every document-level
   listener below would gain a second copy — including the form handler,
   which would submit each enquiry twice. The IIFE closes at end of file. */
(function () {
if (window.__sabdiaMainInit) return;
window.__sabdiaMainInit = true;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

/* ── LIFETIME TRACKING ─────────────────────────────────────── */
let pageIntervals = [];
let pageObservers = [];
let pageScroll = [];   // per-page scroll work, driven by the one listener below

const onInterval = (fn, ms) => { pageIntervals.push(setInterval(fn, ms)); };
const onObserve = (obs) => { pageObservers.push(obs); return obs; };
const onScroll = (fn) => { pageScroll.push(fn); };

function teardown() {
  pageIntervals.forEach(clearInterval);
  pageObservers.forEach((o) => o.disconnect());
  pageIntervals = [];
  pageObservers = [];
  pageScroll = [];
}

/* ============================================================
   ONE-TIME — document & window scope
   ============================================================ */

/* Astro replaces <html>'s attributes with the incoming document's on
   swap, and the incoming markup is server-rendered — so the classes
   added by the head script are lost on every client-side navigation.
   `js` gates the whole reveal system (without it .reveal never hides,
   so nothing animates in), and by definition the opening loader has
   been seen by the time any navigation happens. */
document.addEventListener('astro:after-swap', () => {
  document.documentElement.classList.add('js', 'no-loader');
});

/* Navigation feedback. The gap between a click and the new page's HTML
   arriving is entirely invisible otherwise — no spinner, no page unload,
   nothing — so a slow render reads as an interface that ignored you.
   Driven from the preparation events rather than the swap, because it is
   precisely the fetch that needs covering. Classes live on <html>, which
   survives the swap; the bar itself is replaced with the rest of the body,
   so `nav-done` is cleared on the next tick ready for the next navigation. */
document.addEventListener('astro:before-preparation', () => {
  document.documentElement.classList.remove('nav-done');
  document.documentElement.classList.add('is-navigating');
});
document.addEventListener('astro:after-preparation', () => {
  document.documentElement.classList.remove('is-navigating');
  document.documentElement.classList.add('nav-done');
  setTimeout(() => document.documentElement.classList.remove('nav-done'), 600);
});

/* ── NAVIGATION VEIL — black SABDIA frame over every page change ──
   Owner request: each navigation shows the wordmark while the next page
   renders behind it. Raised the instant the fetch starts; on page-load
   it is held to a minimum on-screen time so it reads as a deliberate
   frame rather than a flash. The veil element is replaced with each
   body — the class lives on <html>, which survives the swap. Reduced
   motion skips the artificial hold but keeps the covering itself. */
const VEIL_MIN_MS = 1400;
let veilShownAt = 0;
let veilNav = 0; // navigation token — a newer navigation invalidates pending hides
document.addEventListener('astro:before-preparation', () => {
  veilNav++;
  veilShownAt = Date.now();
  document.documentElement.classList.add('nav-veil');
});
/* The swap resets <html> attributes to the incoming page's, which wipes
   the class raised above. after-swap runs synchronously inside the swap —
   re-asserting here means no frame is ever painted without the veil. */
document.addEventListener('astro:after-swap', () => {
  if (veilShownAt) document.documentElement.classList.add('nav-veil');
});
document.addEventListener('astro:page-load', () => {
  if (!veilShownAt) return; // initial full load — the homepage intro owns that moment
  const nav = veilNav;
  const hold = reduceMotion ? 0 : Math.max(0, VEIL_MIN_MS - (Date.now() - veilShownAt));
  /* Hold the veil until the incoming page's header image has painted, so
     the reveal is a composed page, never a bare header band waiting on a
     cold image render. Capped — a missing or dead hero can't lock the
     door — and the minimum hold still applies to fast, cached arrivals. */
  const hero = document.querySelector('.page-hero img, .prop-hero img, .hero img, .h-slides img');
  const heroReady = new Promise((done) => {
    if (!hero || hero.complete) return done();
    hero.addEventListener('load', done, { once: true });
    hero.addEventListener('error', done, { once: true });
    setTimeout(done, reduceMotion ? 900 : 2800);
  });
  const minHold = new Promise((done) => setTimeout(done, hold));
  Promise.all([minHold, heroReady]).then(() => {
    if (nav !== veilNav) return; // a newer navigation owns the veil now
    veilShownAt = 0;
    document.documentElement.classList.remove('nav-veil');
  });
});

/* A navigation cancels any open overlay, and body scroll-lock is set
   on the old body — but Astro carries inline style across the swap,
   so a lightbox left open would strand the next page unscrollable. */
document.addEventListener('astro:before-swap', () => {
  teardown();
  document.body.style.overflow = '';
});

// ── KEYBOARD VS MOUSE — restore real cursor on Tab ──────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    document.body.classList.add('kb-nav');
    document.documentElement.classList.remove('cursor-fx');
  }
});
document.addEventListener('mousedown', () => document.body.classList.remove('kb-nav'));

/* The moment a backgrounded tab is looked at, re-run the reveal sweep. A
   browser that suspended IntersectionObserver while hidden may have left
   elements unrevealed, and with .reveal-wipe that reads as missing content.
   Document-scoped, so registered once and routed through whatever the
   current page's sweep is. */
let revealSweep = null;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && revealSweep) revealSweep();
});

// Escape closes the mobile menu from anywhere on the page, so it has to be
// document-scoped. Registered once and routed through mobNavApi, which
// initPage rebuilds — binding it to the button instead would only work
// while the button itself held focus.
let mobNavApi = null;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mobNavApi && mobNavApi.isOpen()) mobNavApi.close();
});

// ── CURSOR (cursor:fine devices) ────────────────────────────
// The elements live in Nav, so they are replaced on every navigation.
// The tracking loop is registered once and reads whatever the current
// page's elements are, via refs that initPage refreshes.
let curDot = null;
let curRing = null;
if (finePointer && !reduceMotion) {
  let mx = 0, my = 0, rx = 0, ry = 0;
  // Hide the system cursor only after the custom one is provably
  // following the mouse — never before, so a failure here can't leave
  // the visitor without a pointer.
  document.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    if (!curDot) return;
    curDot.style.left = mx + 'px';
    curDot.style.top = my + 'px';
    document.documentElement.classList.add('cursor-fx');
  });
  (function animate() {
    if (curRing) {
      rx += (mx - rx) * 0.13; ry += (my - ry) * 0.13;
      curRing.style.left = rx + 'px';
      curRing.style.top = ry + 'px';
    }
    requestAnimationFrame(animate);
  })();
}

// ── SCROLL DRIVER ───────────────────────────────────────────
// One listener, one rAF, for every scroll-linked effect on the page.
// Previously three independent listeners each ran their own ticking
// flag, so a single scroll could schedule three frames of work.
(() => {
  let ticking = false;
  const frame = () => {
    ticking = false;
    for (const fn of pageScroll) fn();
  };
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request, { passive: true });
})();

// ── SMOOTH SCROLL (delegated) ───────────────────────────────
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (href === '#' || href.length < 2) return;
  const target = document.querySelector(href);
  if (!target) return;
  e.preventDefault();
  window.scrollTo({
    top: target.getBoundingClientRect().top + window.scrollY - 80,
    behavior: reduceMotion ? 'auto' : 'smooth'
  });
});

// ── CONTACT FORMS (delegated) ──────────────────────────────
// Two backends, one behaviour: the visitor never leaves the page.
//  • Shopify mode: POST to Shopify's /contact in the background (it emails
//    the store), then swap the form for the thank-you panel. Shopify's
//    spam challenge, if it ever fires, falls back to a normal submit.
//  • Sabdia API mode: POST to /api/contact as before.
// In Shopify mode the enquiry is also mirrored to the API (Customers,
// leads inbox) when Theme settings › Site plumbing has an endpoint.
const THANKS_HTML = (h, t) => '<div class="form-thanks" id="formThanks" role="status" tabindex="-1"><div class="form-thanks-k" aria-hidden="true">&#10003;</div><h3 class="form-thanks-h">' + h + '</h3><p class="form-thanks-p">' + t + '</p></div>';
function showThanks(form, heading, text) {
  const cfg = (window.SabdiaForms && window.SabdiaForms.thanks) || {};
  const wrap = document.createElement('div');
  wrap.innerHTML = THANKS_HTML(heading || cfg.heading || 'Thank you', text || cfg.text || 'We will be in touch within a business day.');
  const panel = wrap.firstChild;
  form.replaceWith(panel);
  panel.classList.add('vis');
  setTimeout(() => { panel.scrollIntoView({ behavior: 'smooth', block: 'center' }); panel.focus({ preventScroll: true }); }, 60);
}
function thanksText(form) {
  /* A tailored thank-you for the chosen enquiry type wins (Customize: "Option | text"). */
  const sel = form.querySelector('select[name="contact[Enquiry type]"], select[name="contact[Interest]"]');
  if (sel && sel.value) {
    const special = Array.from(form.querySelectorAll('[data-thanks-for]')).find((s) => s.getAttribute('data-thanks-for') === sel.value);
    if (special && special.textContent.trim()) return special.textContent.trim();
  }
  /* Otherwise pick Sabdia's reply by what the person asked for: the chosen
     option plus their message (a "General" enquiry about a renovation still
     gets the client-build reply). */
  const replies = (window.SabdiaForms && window.SabdiaForms.replies) || [];
  const v = (n) => { const e = form.querySelector('[name="' + n + '"]'); return e ? String(e.value || '') : ''; };
  const asked = ((sel ? sel.value : '') + ' ' + v('contact[body]') + ' ' + v('contact[Agency]') + ' ' + (form.getAttribute('data-form-name') || '')).toLowerCase();
  for (let k = 0; k < replies.length; k++) {
    try { if (new RegExp(replies[k].match, 'i').test(asked)) return replies[k].text; } catch (e) { /* bad pattern */ }
  }
  /* Buyer enquiry with the pre-qualification left blank: ask for budget and timeline (Naomi's wording). */
  const ask = form.querySelector('[data-prequal-ask]');
  if (ask && (!v('contact[Budget range]') || !v('contact[Timeline]'))) return ask.textContent.trim();
  const el = form.querySelector('[data-thanks]');
  return (el && el.textContent.trim()) || form.getAttribute('data-thanks') || null;
}
function thanksHeading(form) {
  const e = form.querySelector('[name="contact[First name]"], [name="contact[first_name]"], [name="first-name"]');
  const first = e ? String(e.value || '').trim().split(/\s+/)[0] : '';
  /* Greeting the way Sabdia's replies open ("Good morning Mark,"); the
     message below carries the thank-you, so the heading never repeats it. */
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : (hr < 17 ? 'Good afternoon' : 'Good evening');
  return first ? greet + ', ' + first.charAt(0).toUpperCase() + first.slice(1) : greet;
}
function mirrorEnquiry(form) {
  const url = window.SabdiaForms && window.SabdiaForms.mirror;
  if (!url) return;
  const out = { 'form-name': form.getAttribute('data-form-name') || 'contact' };
  new FormData(form).forEach((v, k) => {
    const m = /^contact\[(.+)\]$/.exec(k);
    if (!m || k === 'contact[tags]') return;
    let key = m[1].toLowerCase().replace(/\s+/g, '-');
    if (key === 'body') key = 'message';
    if (key === 'interest') key = 'enquiry-type';
    out[key] = String(v);
  });
  try {
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out), keepalive: true, mode: 'cors' }).catch(() => {});
  } catch (err) { /* mirror is best-effort */ }
}
document.addEventListener('submit', async (e) => {
  const cform = e.target.closest && e.target.closest('form#cform, form.cform');
  if (!cform) return;
  const action = cform.getAttribute('action') || '';
  if (!/\/api\//.test(action)) return; // Shopify-native forms post into a hidden frame (nativeFormInit)
  const native = false;
  e.preventDefault();
  const btn = cform.querySelector('#fsub, .fsub');
  if (!btn || btn.disabled) return;
  const status = cform.querySelector('[data-form-status]');
  const announce = (msg) => { if (status) status.textContent = msg; };
  const label = btn.textContent;
  btn.textContent = 'Sending…';
  btn.disabled = true;
  btn.style.background = '#6B6860';
  announce('Sending your enquiry…');
  try {
    const body = new URLSearchParams(new FormData(cform)).toString();
    const res = await fetch(action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
      body,
      credentials: 'same-origin',
      redirect: 'follow'
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new Error((detail && detail.error) || `Form submit failed: ${res.status}`);
    }
    showThanks(cform, thanksHeading(cform), thanksText(cform));
  } catch (err) {
    const msg = (err && err.message && !/^Form submit failed|Failed to fetch|NetworkError/.test(err.message))
      ? err.message
      : 'Something went wrong — please try again.';
    btn.textContent = label;
    btn.disabled = false;
    btn.style.background = '';
    announce(msg);
    let note = cform.querySelector('.form-error');
    if (!note) { note = document.createElement('p'); note.className = 'form-note form-error'; note.setAttribute('role', 'alert'); btn.insertAdjacentElement('afterend', note); }
    note.textContent = msg;
  }
});

/* Share row: copy-link. */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.share-copy');
  if (!btn) return;
  try {
    await navigator.clipboard.writeText(btn.getAttribute('data-share-url') || location.href);
    const t = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = t; }, 1800);
  } catch (err) {
    window.prompt('Copy this link:', btn.getAttribute('data-share-url') || location.href);
  }
});

/* Newsletter signup (footer, every page). */
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('#nlForm');
  if (!form) return;
  const nlAction = form.getAttribute('action') || '';
  if (!/\/api\//.test(nlAction)) return; // native newsletter posts into a hidden frame (nativeFormInit)
  const nlNative = false;
  e.preventDefault();
  const btn = form.querySelector('.nl-btn');
  const status = form.querySelector('[data-form-status]');
  const announce = (msg) => { if (status) status.textContent = msg; };
  if (!btn || btn.disabled) return;
  const original = btn.textContent;
  btn.textContent = '…';
  btn.disabled = true;
  try {
    const res = await fetch(nlAction || '/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
      body: new URLSearchParams(new FormData(form)).toString(),
      credentials: 'same-origin',
      redirect: 'follow'
    });
    if (nlNative) {
      if (/\/challenge/.test(res.url)) { btn.disabled = false; form.submit(); return; }
      if (!(/customer_posted=true/.test(res.url) || res.redirected)) {
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const err = doc.querySelector('#nlForm [role="status"], #nlForm .errors');
        throw new Error((err && err.textContent.trim()) || 'subscribe failed');
      }
    } else if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new Error((detail && detail.error) || 'subscribe failed: ' + res.status);
    }
    const doneEl = form.querySelector('[data-nl-success]');
    const done = (doneEl && doneEl.textContent.trim()) || form.getAttribute('data-success') || 'Thank you — you\'re subscribed.';
    form.innerHTML = '<p class="nl-done">' + done + '</p>';
    announce(done);
  } catch (err) {
    btn.textContent = original;
    btn.disabled = false;
    announce((err && err.message && !/^subscribe failed|Failed to fetch|NetworkError/.test(err.message))
      ? err.message
      : 'Something went wrong — please try again.');
  }
});

/* ============================================================
   PER PAGE — re-run on every astro:page-load
   ============================================================ */



/* File the enquirer under Customers. Shopify's contact form only emails, so
   the accepted enquiry is copied into the hidden signup form next to it
   (snippet customer-mirror) and that is submitted in the background:
   Customers then holds the person, tagged enquiry · residence · enquiry
   type · newsletter (when "Keep me updated" was ticked). Segments in the
   admin can then be built on those tags. */
function fileCustomer(form, saved) {
  const wrap = form.parentNode && form.parentNode.querySelector('[data-customer-mirror]');
  const mirror = wrap && wrap.querySelector('form');
  if (!mirror) return;
  const submitMirror = () => {
    const em = mirror.querySelector('[name="contact[email]"]');
    em.dispatchEvent(new Event('focusin', { bubbles: true }));
    em.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(() => { if (mirror.requestSubmit) mirror.requestSubmit(); else mirror.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }, 1500);
  };
  const setM = (n, v) => { const el = mirror.querySelector('[name="' + n + '"]'); if (el) el.value = v; };
  if (saved) {
    setM('contact[email]', saved.email); setM('contact[first_name]', saved.first); setM('contact[last_name]', saved.last); setM('contact[tags]', saved.tags); setM('contact[note]', saved.note || ''); setM('contact[phone]', saved.phone || '');
    submitMirror();
    return;
  }
  const val = (n) => { const el = form.querySelector('[name="' + n + '"]'); return el ? String(el.value || '').trim() : ''; };
  const email = val('contact[email]');
  if (!email) return;
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const tags = ['enquiry'];
  const residences = (window.SabdiaForms && window.SabdiaForms.residences) || [];
  const seen = {};
  if (wrap.getAttribute('data-residence')) { tags.push(wrap.getAttribute('data-residence')); seen[wrap.getAttribute('data-residence')] = 1; }
  const blob = Array.from(form.elements).map((el) => (el.type === 'checkbox' && !el.checked) ? '' : String(el.value || '')).join(' ').toLowerCase();
  residences.forEach((h) => { if (!seen[h] && new RegExp('\\b' + h + '\\b').test(blob)) { tags.push(h); seen[h] = 1; } });
  const etype = val('contact[Enquiry type]') || val('contact[Interest]');
  if (etype) tags.push(slug(etype).slice(0, 40));
  if (val('contact[Budget range]')) tags.push('budget-' + slug(val('contact[Budget range]')).slice(0, 30));
  if (val('contact[Timeline]')) tags.push('timeline-' + slug(val('contact[Timeline]')).slice(0, 30));
  val('contact[Preferred locations]').split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => tags.push('loc-' + slug(x).slice(0, 30)));
  const optin = form.querySelector('[data-optin]');
  if (optin && optin.checked) tags.push('newsletter');
  const noteOf = () => [
    val('contact[Property]') && 'Residence: ' + val('contact[Property]'),
    (val('contact[Enquiry type]') || val('contact[Interest]')) && 'Interest: ' + (val('contact[Enquiry type]') || val('contact[Interest]')),
    val('contact[Budget range]') && 'Budget: ' + val('contact[Budget range]'),
    val('contact[Timeline]') && 'Timeline: ' + val('contact[Timeline]'),
    val('contact[Preferred locations]') && 'Locations: ' + val('contact[Preferred locations]'),
    val('contact[Flexibility]') && 'Flexibility: ' + val('contact[Flexibility]'),
    val('contact[Agency]') && 'Agency: ' + val('contact[Agency]'),
    val('contact[body]') && 'Message: ' + val('contact[body]'),
    'Via ' + (location.pathname || '/') + ' on ' + new Date().toLocaleDateString('en-AU')
  ].filter(Boolean).join('\n');
  const payload = { email, first: val('contact[First name]') || val('contact[first_name]'), last: val('contact[Last name]') || val('contact[last_name]'), tags: tags.join(', '), note: noteOf(), phone: val('contact[Phone]') };
  setM('contact[email]', payload.email); setM('contact[first_name]', payload.first); setM('contact[last_name]', payload.last); setM('contact[tags]', payload.tags); setM('contact[note]', payload.note); setM('contact[phone]', payload.phone);
  try { sessionStorage.removeItem('sabdia-file-customer'); } catch (e) {}
  submitMirror();
}
/* Called when an enquiry is about to leave for Shopify's visible challenge
   page: keep what Customers needs, and file it when the visitor returns. */
function stashCustomer(form) {
  try {
    const val = (n) => { const el = form.querySelector('[name="' + n + '"]'); return el ? String(el.value || '').trim() : ''; };
    const wrap = form.parentNode && form.parentNode.querySelector('[data-customer-mirror]');
    if (!wrap || !val('contact[email]')) return;
    const optin = form.querySelector('[data-optin]');
    const etype = val('contact[Enquiry type]') || val('contact[Interest]');
    const tags = ['enquiry'];
    if (wrap.getAttribute('data-residence')) tags.push(wrap.getAttribute('data-residence'));
    const blob = Array.from(form.elements).map((el) => (el.type === 'checkbox' && !el.checked) ? '' : String(el.value || '')).join(' ').toLowerCase();
    ((window.SabdiaForms && window.SabdiaForms.residences) || []).forEach((h) => { if (tags.indexOf(h) === -1 && new RegExp('\\b' + h + '\\b').test(blob)) tags.push(h); });
    if (etype) tags.push(etype.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40));
    const sl = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (val('contact[Budget range]')) tags.push('budget-' + sl(val('contact[Budget range]')).slice(0, 30));
    if (val('contact[Timeline]')) tags.push('timeline-' + sl(val('contact[Timeline]')).slice(0, 30));
    val('contact[Preferred locations]').split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => tags.push('loc-' + sl(x).slice(0, 30)));
    if (optin && optin.checked) tags.push('newsletter');
    const note = ['Residence: ' + val('contact[Property]'), 'Interest: ' + etype, 'Budget: ' + val('contact[Budget range]'), 'Timeline: ' + val('contact[Timeline]'), 'Locations: ' + val('contact[Preferred locations]'), 'Message: ' + val('contact[body]')].filter((l) => !/: $/.test(l)).join('\n');
    sessionStorage.setItem('sabdia-file-customer', JSON.stringify({ email: val('contact[email]'), first: val('contact[First name]'), last: val('contact[Last name]'), tags: tags.join(', '), note, phone: val('contact[Phone]'), t: Date.now() }));
  } catch (e) { /* storage unavailable */ }
}

/* Shopify-native forms ({% form 'contact' %} and {% form 'customer' %}, both
   posting to /contact) without leaving the page. Shopify's spam script
   (hCaptcha) binds to these forms, and on submit it fetches a token and then
   calls form.submit(). That call is intercepted here and sent in the
   background instead; Shopify validates and emails as usual, and the
   visitor sees the thank-you in place. If Shopify still insists on its
   visible challenge page, the real navigation happens and the thank-you
   shows after the return (see the contact_posted handler in initPage). */
function nativeFormInit() {
  document.querySelectorAll('form').forEach((form) => {
    if (form.dataset.nativeWired) return;
    if (!/^\/contact/.test(form.getAttribute('action') || '')) return;
    form.dataset.nativeWired = '1';
    const isNews = form.id === 'nlForm';
    const silent = !!form.closest('[data-customer-mirror]');
    const btn = form.querySelector('#fsub, .fsub, .nl-btn, [type="submit"]');
    const status = form.querySelector('[data-form-status]');
    const announce = (msg) => { if (status) status.textContent = msg; };
    let pending = false, label = btn ? btn.textContent : '';
    const busy = () => {
      pending = true;
      if (silent) return;
      const err = form.querySelector('.form-error'); if (err) err.remove();
      if (btn) { label = btn.textContent; btn.textContent = isNews ? '…' : 'Sending…'; btn.style.background = '#6B6860'; }
      announce('Sending…');
    };
    const fail = (msg) => {
      pending = false;
      if (silent) return;
      if (btn) { btn.textContent = label; btn.style.background = ''; }
      announce(msg);
      let note = form.querySelector('.form-error');
      if (!note) { note = document.createElement('p'); note.className = isNews ? 'sr-status form-error' : 'form-note form-error'; note.setAttribute('role', 'alert'); (btn || form).insertAdjacentElement('afterend', note); }
      note.textContent = msg;
    };
    const done = () => {
      pending = false;
      if (silent) return;
      if (!isNews) fileCustomer(form);
      if (isNews) {
        const doneEl = form.querySelector('[data-nl-success]');
        form.innerHTML = '<p class="nl-done">' + ((doneEl && doneEl.textContent.trim()) || 'Thank you — you\'re subscribed.') + '</p>';
      } else {
        mirrorEnquiry(form);
        showThanks(form, thanksHeading(form), thanksText(form));
      }
    };
    const send = async () => {
      try {
        const res = await fetch(form.getAttribute('action').split('#')[0], {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
          body: new URLSearchParams(new FormData(form)).toString(),
          credentials: 'same-origin',
          redirect: 'follow'
        });
        if (/\/challenge/.test(res.url)) { if (!isNews && !silent) stashCustomer(form); location.assign(res.url); return; } // Shopify's visible check; it holds the enquiry and returns here
        const ok = isNews ? /customer_posted=true/.test(res.url) : /contact_posted=true/.test(res.url);
        if (ok) { done(); return; }
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const alert = doc.querySelector((isNews ? '#nlForm' : '#cform') + ' [role="alert"], .errors');
        if (alert && alert.textContent.trim()) throw new Error(alert.textContent.trim());
        if (/CAPTCHA/i.test(doc.title || '')) throw new Error('The spam check did not pass — please press the button again.');
        if (res.ok && !alert && !/\/contact/.test(res.url)) { done(); return; }
        throw new Error('Something went wrong — please try again.');
      } catch (err) {
        fail((err && err.message && !/Failed to fetch|NetworkError/.test(err.message)) ? err.message : 'Something went wrong — please try again.');
      }
    };
    /* Shopify's spam script ends with form.submit(); take it from here. */
    form.submit = function () { if (!pending) busy(); send(); };
    form.addEventListener('submit', (e) => {
      if (pending) { e.preventDefault(); return; }
      if (!form.checkValidity()) return;
      busy();
      /* Not under Shopify's spam script (protection off, or its script did
         not load): post directly. Otherwise let it run; it calls submit(). */
      if (!form.dataset.cptcha && !form.dataset.hcaptchaBound && !form.dataset.recaptchaBound) { e.preventDefault(); send(); }
    });
  });
}


/* Pre-qualification. The Interest choice decides what else is asked:
   a residence (QASR - Coorparoo) or For Sale opens budget, timeline and
   locations; anything else (custom build, agent, media, general) hides
   them. Budget and timeline become required when shown; locations are
   required for a general For Sale enquiry and optional for a residence,
   whose suburb is pre-selected. Residence pages always show the block. */
function prequalInit() {
  const map = (window.SabdiaForms && window.SabdiaForms.residenceMap) || [];
  document.querySelectorAll('[data-prequal]').forEach((wrap) => {
    if (wrap.dataset.pqInit) return;
    wrap.dataset.pqInit = '1';
    const form = wrap.closest('form');
    if (!form) return;
    const sel = form.querySelector('select[name="contact[Interest]"], select[name="contact[Enquiry type]"], select[name="enquiry-type"]');
    const budget = wrap.querySelector('[data-prequal-budget]'), time = wrap.querySelector('[data-prequal-timeline]');
    const chips = Array.from(wrap.querySelectorAll('[data-prequal-loc]')), hiddenLoc = wrap.querySelector('[data-prequal-locations]');
    const locLabel = wrap.querySelector('[data-prequal-loclabel]'), locReq = locLabel && locLabel.querySelector('[data-prequal-req]');
    const pageSuburb = wrap.getAttribute('data-residence-suburb') || '';
    const norm = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const residenceFor = (value) => {
      const v = norm(value);
      if (!v) return null;
      return map.find((r) => v.indexOf(norm(r.title)) !== -1 || (r.handle && new RegExp('\\b' + r.handle + '\\b').test(v))) || null;
    };
    const syncLoc = () => {
      if (hiddenLoc) hiddenLoc.value = chips.filter((c) => c.checked).map((c) => c.value).join(', ');
      if (chips.length) chips[0].setCustomValidity(wrap.dataset.locRequired === '1' && !chips.some((c) => c.checked) ? 'Please choose at least one location' : '');
    };
    chips.forEach((c) => c.addEventListener('change', syncLoc));
    const apply = () => {
      let mode = 'none', suburb = '';
      if (pageSuburb) { mode = 'residence'; suburb = pageSuburb; }
      else if (sel) {
        const r = residenceFor(sel.value);
        if (r) { mode = 'residence'; suburb = r.suburb || ''; }
        else if (/for sale|current propert|purchase|buy|residence|home for|off.?market|upcoming|release/i.test(sel.value)) mode = 'forsale';
      } else { mode = 'forsale'; }
      const show = mode !== 'none';
      wrap.hidden = !show;
      if (budget) budget.required = show;
      if (time) time.required = show;
      chips.forEach((c) => { if (c.dataset.locked === '1') { c.checked = false; c.disabled = false; c.dataset.locked = ''; c.parentNode.classList.remove('chip-home'); } });
      if (mode === 'residence' && suburb) {
        const home = chips.find((c) => norm(c.value) === norm(suburb));
        if (home) { home.checked = true; home.dataset.locked = '1'; home.parentNode.classList.add('chip-home'); }
      }
      wrap.dataset.locRequired = mode === 'forsale' ? '1' : '0';
      if (locLabel) {
        locLabel.firstChild.textContent = mode === 'residence' ? locLabel.getAttribute('data-label-residence') : locLabel.getAttribute('data-label-forsale');
        if (locReq) locReq.hidden = mode !== 'forsale';
      }
      syncLoc();
    };
    if (sel) sel.addEventListener('change', apply);
    apply();
  });
}

function initPage() {
  nativeFormInit();
  prequalInit();
  if (window.SabdiaForms) window.SabdiaForms.preview = { thanksText, thanksHeading }; // lets staff test replies from the console
  /* After Shopify accepts an enquiry it reloads the page with
     ?contact_posted=true. Show the thank-you where the form was and bring
     it into view (the form sits below the fold on most pages). */
  if (/[?&]contact_posted=true/.test(location.search)) {
    var thanks = document.getElementById('formThanks');
    var fyh = document.querySelector('form[data-fyh]');
    if (!thanks && fyh) {
      thanks = document.createElement('div');
      thanks.className = 'form-thanks'; thanks.id = 'formThanks'; thanks.setAttribute('role', 'status'); thanks.tabIndex = -1;
      thanks.innerHTML = '<div class="form-thanks-k" aria-hidden="true">&#10003;</div><h3 class="form-thanks-h">Thank you</h3><p class="form-thanks-p">We have your answers and will be in touch within a business day.</p>';
      fyh.parentNode.insertBefore(thanks, fyh); fyh.hidden = true;
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem('sabdia-file-customer') || 'null');
      const cform = document.getElementById('cform') || document.querySelector('form.cform');
      if (saved && cform && Date.now() - saved.t < 30 * 60 * 1000) { sessionStorage.removeItem('sabdia-file-customer'); setTimeout(() => fileCustomer(cform, saved), 800); }
    } catch (e) { /* no storage */ }
    if (thanks) {
      thanks.classList.add('vis');
      setTimeout(function () { thanks.scrollIntoView({ behavior: 'smooth', block: 'center' }); thanks.focus({ preventScroll: true }); }, 250);
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
    }
  }

  // Refresh the cursor element refs for this page's Nav.
  curDot = document.getElementById('cur');
  curRing = document.getElementById('cur-r');

  // ── BRISBANE CLOCK (UTC+10, no DST) ───────────────────────
  const fmtBris = () => {
    try {
      return new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Brisbane',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date()) + ' BNE';
    } catch (e) { return 'BNE'; }
  };
  const navTime = document.getElementById('navTime');
  if (navTime) {
    navTime.textContent = fmtBris();
    onInterval(() => { navTime.textContent = fmtBris(); }, 30000);
  }

  // ── LOADER ────────────────────────────────────────────────
  // Homepage-only, first visit per session (see Nav.astro + Base.astro).
  //
  // This used to hang off `window.load`, which waits for every image on
  // the page — on a slideshow hero that is seconds of cream, and the
  // visitor is held behind a wash long after the first slide is actually
  // paintable. Now whichever comes first wins: the load event, or a hard
  // cap. The cap means a slow image can never hold the door shut.
  const loader = document.getElementById('loader');
  if (loader) {
    let done = false;
    const dismiss = () => {
      if (done) return;
      done = true;
      loader.classList.add('out');
      setTimeout(() => loader.remove(), 520);
    };
    const hold = reduceMotion ? 120 : 420;
    const cap = reduceMotion ? 200 : 900;
    setTimeout(dismiss, cap);
    window.addEventListener('load', () => setTimeout(dismiss, hold), { once: true });
  }

  // ── NAV SCROLL STATE ──────────────────────────────────────
  const mainNav = document.getElementById('mainNav');
  if (mainNav) {
    const paint = () => mainNav.classList.toggle('sc', window.scrollY > 60);
    onScroll(paint);
    paint();
  }

  // ── MOBILE NAV ────────────────────────────────────────────
  const mobBtn = document.getElementById('mobBtn');
  const mobNav = document.getElementById('mobNav');
  mobNavApi = null;
  if (mobBtn && mobNav) {
    let open = false;
    const set = (v) => {
      open = v;
      mobNav.classList.toggle('open', open);
      mobNav.setAttribute('aria-hidden', String(!open));
      mobBtn.setAttribute('aria-expanded', String(open));
      mobBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
      const spans = mobBtn.querySelectorAll('span');
      if (open) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
      }
    };
    mobBtn.addEventListener('click', () => set(!open));
    mobNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => set(false)));
    mobNavApi = { isOpen: () => open, close: () => set(false) };
  }

  // ── HERO SLIDESHOW + STRIP INDICATOR ──────────────────────
  const slides = document.querySelectorAll('.h-slide');
  const hDots = document.querySelectorAll('#hDots .h-dot');
  const hScrollNum = document.querySelector('.h-scroll-num');
  if (slides.length > 1) {
    let si = 0;
    const total = slides.length;
    const pad = (n) => String(n).padStart(2, '0');
    const update = () => {
      hDots.forEach((d, i) => d.classList.toggle('active', i === si));
      if (hScrollNum) hScrollNum.textContent = `${pad(si + 1)} / ${pad(total)}`;
    };
    const goTo = (i) => {
      slides[si].classList.remove('active');
      si = (i + total) % total;
      slides[si].classList.add('active');
      // restart the Ken Burns drift from scale(1) for the incoming slide
      const img = slides[si].querySelector('img');
      if (img && !reduceMotion) {
        img.style.animation = 'none';
        void img.offsetWidth;
        img.style.animation = '';
      }
      update();
    };
    update();
    let auto = null;
    if (!reduceMotion) {
      auto = setInterval(() => goTo(si + 1), 6200);
      pageIntervals.push(auto);
    }
    hDots.forEach((d, i) => d.addEventListener('click', () => {
      if (auto) { clearInterval(auto); auto = null; }
      goTo(i);
    }));
  }

  // ── REVEAL ON SCROLL ──────────────────────────────────────
  const revealSel = '.reveal,.reveal-x,.reveal-r,.reveal-wipe,.reveal-wipe-x';
  revealSweep = null;
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const revealEls = [...document.querySelectorAll(revealSel)];
    const revealObs = onObserve(new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('vis'); revealObs.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -52px 0px' }));
    revealEls.forEach((el) => revealObs.observe(el));

    /* Backstop. .reveal-wipe hides content behind a clip-path, so a reveal
       that never fires leaves it invisible rather than merely un-animated —
       a decorative effect silently eating real content.

       That is reachable in normal use: a browser suspends
       IntersectionObserver while a tab is backgrounded, so a page opened
       with cmd-click, restored with a session, or throttled can finish
       loading having never received a callback. This recomputes the same
       rule directly from layout, which is cheap because it rides the
       existing rAF-throttled scroll driver and stops doing any work once
       everything has revealed. */
    /* Anything already in the viewport right now gets the quick entrance
       (.fastin) — the slow staggered pace is for elements arriving on
       scroll, not for the content the visitor is looking at. */
    const vh0 = window.innerHeight;
    revealEls.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh0 && r.bottom > 0) el.classList.add('fastin');
    });

    let pending = revealEls;
    revealSweep = () => {
      if (!pending.length) return;
      const vh = window.innerHeight;
      pending = pending.filter((el) => {
        if (el.classList.contains('vis')) return false;
        const r = el.getBoundingClientRect();
        if (r.top < vh - 52 && r.bottom > 0) {
          el.classList.add('vis');
          revealObs.unobserve(el);
          return false;
        }
        return true;
      });
    };
    onScroll(revealSweep);
    revealSweep();

    /* The sweep above only sees the layout as it stands at wire-up time.
       Hero imagery, web fonts and the gallery grid all settle after that,
       and each reflow can push a new element into view without a scroll to
       announce it. The observer normally catches those; these re-checks
       mean a page that is never scrolled — someone landing deep-linked on
       a section, or reading without touching the wheel — cannot be left
       looking at a clipped, empty container. They only ever reveal what is
       genuinely in view, so nothing below the fold is spoiled. */
    [220, 800, 2000].forEach((ms) => setTimeout(revealSweep, ms));
    window.addEventListener('load', revealSweep, { once: true });
  } else {
    document.querySelectorAll(revealSel).forEach((el) => el.classList.add('vis'));
  }

  /* Theme editor. The customizer injects and re-renders sections without
     reloading, so they arrive after the observer was wired up and stay
     hidden (opacity 0 / clipped) until a refresh. Reveal whatever the
     editor adds or touches straight away. Never runs for visitors. */
  if (window.Shopify && window.Shopify.designMode) {
    const showAll = (root) => {
      if (!root || root.nodeType !== 1) return;
      if (root.matches(revealSel)) root.classList.add('vis', 'fastin');
      root.querySelectorAll(revealSel).forEach((el) => el.classList.add('vis', 'fastin'));
    };
    ['shopify:section:load', 'shopify:section:select', 'shopify:section:reorder', 'shopify:block:select']
      .forEach((ev) => document.addEventListener(ev, (e) => showAll(e.target)));
    new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach(showAll)))
      .observe(document.body, { childList: true, subtree: true });
  }

  // ── STATS COUNTERS ────────────────────────────────────────
  // Count-up animation removed intentionally (owner decision): the numbers
  // render static at their final values. The markup also ships the final
  // value server-side; this line just covers any stale cached HTML.
  document.querySelectorAll('.counter').forEach((el) => { el.textContent = el.dataset.target; });

  // ── PROCESS TIMELINE FILL ─────────────────────────────────
  const procTrack = document.querySelector('.proc-track');
  if (procTrack && !reduceMotion && 'IntersectionObserver' in window) {
    const procObs = onObserve(new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { procTrack.classList.add('fill'); procObs.unobserve(procTrack); } });
    }, { threshold: 0.3 }));
    procObs.observe(procTrack);
  } else if (procTrack) {
    procTrack.classList.add('fill');
  }

  // ── PARALLAX HERO CONTENT ─────────────────────────────────
  if (window.innerWidth > 768 && !reduceMotion) {
    const hContent = document.querySelector('.h-content');
    if (hContent) {
      onScroll(() => {
        if (window.scrollY < window.innerHeight) {
          hContent.style.transform = `translateY(${window.scrollY * 0.2}px)`;
        }
      });
    }
  }

  // ── MAGNETIC CTAs (subtle) ────────────────────────────────
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.btn-p, .btn-gold, .fsub').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.12}px, ${y * 0.18}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }

  // ── 3D CARD TILT ──────────────────────────────────────────
  // Property cards lean gently toward the cursor. The .55s transform
  // transition on the card doubles as damping, so the tilt feels
  // weighted rather than twitchy.
  if (finePointer && !reduceMotion && window.innerWidth > 768) {
    document.querySelectorAll('.pc, .sc-card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(1100px) rotateX(${(-y * 3).toFixed(2)}deg) rotateY(${(x * 3).toFixed(2)}deg)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  // ── CURSOR HOVER TARGETS ──────────────────────────────────
  if (finePointer && !reduceMotion && curDot) {
    const hov = 'a,button,.pc,.svc-item,.sc-card,.col-item,.proj-card,.about-val,.port-card,input,textarea,select';
    document.querySelectorAll(hov).forEach((el) => {
      el.addEventListener('mouseenter', () => document.body.classList.add('ch'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('ch'));
    });
  }

  // ── CINEMATIC LAYER ───────────────────────────────────────
  // Scroll-linked: nav progress hairline, testimonial word illumination,
  // and parallax depth on editorial imagery. Transform/colour only,
  // skipped under prefers-reduced-motion.
  const progress = document.getElementById('navProgress');

  // Testimonial: split into word spans; words "light up" as the quote
  // moves through the viewport. Screen readers get the original text via
  // a visually-hidden copy (aria-label is prohibited on blockquote).
  let twSpans = [], twEl = null, twLit = -1;
  const quote = document.querySelector('.testi-text');
  if (quote && !reduceMotion && !quote.dataset.split) {
    quote.dataset.split = '1';
    const text = quote.textContent.trim();
    quote.textContent = '';
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    quote.appendChild(sr);
    text.split(/\s+/).forEach((w, i) => {
      if (i > 0) quote.appendChild(document.createTextNode(' '));
      const s = document.createElement('span');
      s.className = 'tw';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = w;
      quote.appendChild(s);
    });
    twSpans = [...quote.querySelectorAll('.tw')];
    twEl = quote;
  }

  // Parallax: editorial images drift gently against scroll.
  const plxEls = (reduceMotion || window.innerWidth <= 768) ? [] :
    [...document.querySelectorAll('.page-hero img, .prop-hero img, .cd-hero img')];
  plxEls.forEach((el) => el.classList.add('plx'));

  if (progress || twEl || plxEls.length) {
    const cinematic = () => {
      const vh = window.innerHeight;

      if (progress) {
        const max = document.documentElement.scrollHeight - vh;
        progress.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
      }

      if (twEl) {
        const r = twEl.getBoundingClientRect();
        if (r.bottom > -100 && r.top < vh + 100) {
          const p = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (r.height + vh * 0.3)));
          const n = Math.round(p * twSpans.length);
          if (n !== twLit) {
            twSpans.forEach((s, i) => s.classList.toggle('lit', i < n));
            twLit = n;
          }
        }
      }

      plxEls.forEach((el) => {
        const box = el.parentElement.getBoundingClientRect();
        if (box.bottom < 0 || box.top > vh) return;
        const shift = ((box.top + box.height / 2) - vh / 2) * -0.07;
        el.style.transform = `translateY(${shift.toFixed(1)}px) scale(1.12)`;
      });
    };
    onScroll(cinematic);
    cinematic();
  }
}

/* astro:page-load fires on the initial load as well as after every
   client-side navigation, so this is the only entry point needed. */
document.addEventListener('astro:page-load', initPage);

/* ── Film bands ───────────────────────────────────────────────
   Port of FilmBand.astro's inline script — on Astro it ships with the
   component, so the theme has to carry it here. Drives every
   [data-film] frame: play once a third is visible, pause when fully
   out of view, retry transient play() refusals, and the sound toggle. */
function filmInit() {
  document.querySelectorAll('[data-film]').forEach(function (frame) {
    if (frame.dataset.filmInit) return;
    frame.dataset.filmInit = '1';
    var video = frame.querySelector('video');
    var btn = frame.querySelector('[data-sound]');
    var label = frame.querySelector('[data-sound-label]');
    if (!video) return;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if ('IntersectionObserver' in window && !reduced) {
      /* play() is one-shot and its rejection used to be swallowed — a
         transient refusal (power saving, data not buffered, occluded
         tab) left the film permanently frozen until a manual refresh.
         The intent ("should be playing") is tracked and re-attempted
         on canplay, on tab visibility, and on a short bounded retry. */
      var wantPlay = false;
      var retries = 0;
      var attempt = function () {
        if (!wantPlay || !video.isConnected || !video.paused) return;
        var p = video.play();
        if (p && p.catch) p.catch(function () {
          if (wantPlay && retries++ < 12) setTimeout(attempt, 700);
        });
      };
      video.addEventListener('canplay', attempt);
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) attempt();
      });
      /* Hysteresis: start at a third visible, pause only once fully
         gone — a single threshold both ways rapid-cycles play/pause
         on every layout nudge: a visibly glitching film. */
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.intersectionRatio >= 0.35) {
            wantPlay = true;
            retries = 0;
            attempt();
          } else if (!en.isIntersecting) {
            wantPlay = false;
            video.pause();
          }
        });
      }, { threshold: [0, 0.35] });
      io.observe(frame);
    }

    if (btn && label) {
      btn.addEventListener('click', function () {
        video.muted = !video.muted;
        if (!video.muted && video.paused) video.play().catch(function () {});
        label.textContent = video.muted ? 'Sound On' : 'Mute';
      });
    }
  });
}

/* ── Shopify port ─────────────────────────────────────────────
   No Astro ClientRouter here, so astro:page-load never fires. Run the
   per-page init on plain document loads instead; the astro:* listeners
   above simply never fire and stay harmless. Lives INSIDE the module
   closure — initPage is not a global. */
function shopifyBoot() {
  initPage();
  filmInit();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shopifyBoot);
else shopifyBoot();

})();
