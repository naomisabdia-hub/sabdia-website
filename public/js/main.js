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

// ── CONTACT FORMS (delegated) — submit to /api/contact ──────
document.addEventListener('submit', async (e) => {
  const cform = e.target.closest && e.target.closest('form#cform, form.cform');
  if (!cform) return;
  e.preventDefault();
  const btn = cform.querySelector('#fsub, .fsub');
  if (!btn || btn.disabled) return;
  const status = cform.querySelector('[data-form-status]');
  const announce = (msg) => { if (status) status.textContent = msg; };
  btn.textContent = 'Sending…';
  btn.style.background = '#6B6860';
  announce('Sending your enquiry…');
  try {
    const body = new URLSearchParams(new FormData(cform)).toString();
    const res = await fetch(cform.getAttribute('action') || '/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!res.ok) throw new Error(`Form submit failed: ${res.status}`);
    btn.textContent = 'Thank you — we\'ll be in touch shortly.';
    btn.style.background = 'var(--ink2)';
    btn.disabled = true;
    announce('Thank you — your enquiry was sent. We\'ll be in touch shortly.');
  } catch (err) {
    btn.textContent = 'Something went wrong — please try again.';
    btn.style.background = '';
    announce('Something went wrong sending your enquiry — please try again.');
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
  e.preventDefault();
  const btn = form.querySelector('.nl-btn');
  const status = form.querySelector('[data-form-status]');
  const announce = (msg) => { if (status) status.textContent = msg; };
  if (!btn || btn.disabled) return;
  const original = btn.textContent;
  btn.textContent = '…';
  btn.disabled = true;
  try {
    const res = await fetch(form.getAttribute('action') || '/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString()
    });
    if (!res.ok) throw new Error('subscribe failed: ' + res.status);
    const done = form.getAttribute('data-success') || 'Thank you — you\'re subscribed.';
    form.innerHTML = '<p class="nl-done">' + done + '</p>';
    announce(done);
  } catch (err) {
    btn.textContent = original;
    btn.disabled = false;
    announce('Something went wrong — please try again.');
  }
});

/* ============================================================
   PER PAGE — re-run on every astro:page-load
   ============================================================ */

function initPage() {
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

})();
