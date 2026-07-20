/* ============================================================
   SABDIA CONSTRUCTIONS — MAIN JS (v3)
   ============================================================ */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── BRISBANE CLOCK (UTC+10, no DST) ─────────────────────────
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
  setInterval(() => { navTime.textContent = fmtBris(); }, 30000);
}

// ── LOADER ──────────────────────────────────────────────────
// Held the page for 1.6s after load plus a 0.95s fade — ~2.5s of blank
// screen before anyone saw a home. Now a brief warm wash that clears
// quickly; it reads as a considered opening rather than a wait.
window.addEventListener('load', () => {
  setTimeout(() => {
    const l = document.getElementById('loader');
    if (!l) return;
    l.classList.add('out');
    setTimeout(() => l.remove(), 520);
  }, reduceMotion ? 120 : 420);
});

// ── KEYBOARD VS MOUSE — restore real cursor on Tab ──────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    document.body.classList.add('kb-nav');
    document.documentElement.classList.remove('cursor-fx');
  }
});
document.addEventListener('mousedown', () => document.body.classList.remove('kb-nav'));

// ── CURSOR (cursor:fine devices) ────────────────────────────
if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
  const cur = document.getElementById('cur');
  const curR = document.getElementById('cur-r');
  if (cur && curR) {
    let mx = 0, my = 0, rx = 0, ry = 0;
    // Hide the system cursor only after the custom one is provably
    // following the mouse — never before, so a failure here can't leave
    // the visitor without a pointer.
    document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      cur.style.left = mx + 'px'; cur.style.top = my + 'px';
      document.documentElement.classList.add('cursor-fx');
    });
    (function animate() {
      rx += (mx - rx) * 0.13; ry += (my - ry) * 0.13;
      curR.style.left = rx + 'px'; curR.style.top = ry + 'px';
      requestAnimationFrame(animate);
    })();
    const hov = 'a,button,.pc,.svc-item,.sc-card,.col-item,.proj-card,.about-val,.port-card,input,textarea,select';
    document.querySelectorAll(hov).forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('ch'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('ch'));
    });
  }
}

// ── NAV SCROLL STATE ────────────────────────────────────────
const mainNav = document.getElementById('mainNav');
if (mainNav) {
  const onScroll = () => mainNav.classList.toggle('sc', window.scrollY > 60);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ── MOBILE NAV ──────────────────────────────────────────────
const mobBtn = document.getElementById('mobBtn');
const mobNav = document.getElementById('mobNav');
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
  mobNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => set(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) set(false); });
}

// ── HERO SLIDESHOW + STRIP INDICATOR ────────────────────────
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
  let auto;
  if (!reduceMotion) auto = setInterval(() => goTo(si + 1), 6200);
  hDots.forEach((d, i) => d.addEventListener('click', () => {
    if (auto) { clearInterval(auto); auto = null; }
    goTo(i);
  }));
}

// ── REVEAL ON SCROLL ────────────────────────────────────────
if (!reduceMotion && 'IntersectionObserver' in window) {
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); revealObs.unobserve(e.target); } });
  }, { threshold: 0.08, rootMargin: '0px 0px -52px 0px' });
  document.querySelectorAll('.reveal,.reveal-x,.reveal-r,.reveal-wipe,.reveal-wipe-x').forEach(el => revealObs.observe(el));
} else {
  document.querySelectorAll('.reveal,.reveal-x,.reveal-r,.reveal-wipe,.reveal-wipe-x').forEach(el => el.classList.add('vis'));
}

// ── COUNTER ANIMATION ───────────────────────────────────────
if (!reduceMotion && 'IntersectionObserver' in window) {
  const counterObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseInt(el.dataset.target);
      const start = performance.now();
      const duration = 2000;
      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const ep = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.floor(ep * target);
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = target;
      };
      requestAnimationFrame(tick);
      counterObs.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.counter').forEach(el => counterObs.observe(el));
} else {
  document.querySelectorAll('.counter').forEach(el => { el.textContent = el.dataset.target; });
}

// ── PROCESS TIMELINE FILL ───────────────────────────────────
const procTrack = document.querySelector('.proc-track');
if (procTrack && !reduceMotion && 'IntersectionObserver' in window) {
  const procObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { procTrack.classList.add('fill'); procObs.unobserve(procTrack); } });
  }, { threshold: 0.3 });
  procObs.observe(procTrack);
} else if (procTrack) {
  procTrack.classList.add('fill');
}

// ── PARALLAX HERO CONTENT ───────────────────────────────────
if (window.innerWidth > 768 && !reduceMotion) {
  const hContent = document.querySelector('.h-content');
  if (hContent) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (window.scrollY < window.innerHeight) {
          hContent.style.transform = `translateY(${window.scrollY * 0.2}px)`;
        }
        ticking = false;
      });
    }, { passive: true });
  }
}

// ── SMOOTH SCROLL ───────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (href === '#' || href.length < 2) return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY - 80,
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
    }
  });
});

// ── MAGNETIC CTAs (subtle) ──────────────────────────────────
if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
  document.querySelectorAll('.btn-p, .btn-gold, .fsub').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * 0.12}px, ${y * 0.18}px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
  });
}

// ── 3D CARD TILT ────────────────────────────────────────────
// Property cards lean gently toward the cursor. The .55s transform
// transition on the card doubles as damping, so the tilt feels
// weighted rather than twitchy.
if (window.matchMedia('(pointer: fine)').matches && !reduceMotion && window.innerWidth > 768) {
  document.querySelectorAll('.pc, .sc-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(1100px) rotateX(${(-y * 3).toFixed(2)}deg) rotateY(${(x * 3).toFixed(2)}deg)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}

// ── CINEMATIC LAYER ─────────────────────────────────────────
// Scroll-linked effects: nav progress hairline, testimonial word
// illumination, and parallax depth on editorial imagery. One rAF
// loop, transform/color only, skipped under prefers-reduced-motion.
(() => {
  const progress = document.getElementById('navProgress');

  // Testimonial: split into word spans; words "light up" as the
  // quote moves through the viewport. Screen readers get the
  // original text via aria-label on the blockquote.
  let twSpans = [], twEl = null, twLit = -1;
  const quote = document.querySelector('.testi-text');
  if (quote && !reduceMotion) {
    const text = quote.textContent.trim();
    quote.setAttribute('aria-label', text);
    quote.textContent = '';
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
  plxEls.forEach(el => el.classList.add('plx'));

  if (!progress && !twEl && plxEls.length === 0) return;

  let ticking = false;
  const frame = () => {
    ticking = false;
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

    plxEls.forEach(el => {
      const box = el.parentElement.getBoundingClientRect();
      if (box.bottom < 0 || box.top > vh) return;
      const shift = ((box.top + box.height / 2) - vh / 2) * -0.07;
      el.style.transform = `translateY(${shift.toFixed(1)}px) scale(1.12)`;
    });
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  frame();
})();

// ── CONTACT FORMS — submit to /api/contact via AJAX ─────────
document.querySelectorAll('form#cform, form.cform').forEach(cform => {
  cform.addEventListener('submit', async e => {
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
});
