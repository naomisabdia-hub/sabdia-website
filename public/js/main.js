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
window.addEventListener('load', () => {
  setTimeout(() => {
    const l = document.getElementById('loader');
    if (!l) return;
    l.classList.add('out');
    setTimeout(() => l.remove(), 950);
  }, reduceMotion ? 200 : 1600);
});

// ── KEYBOARD VS MOUSE — restore real cursor on Tab ──────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') document.body.classList.add('kb-nav');
});
document.addEventListener('mousedown', () => document.body.classList.remove('kb-nav'));

// ── CURSOR (cursor:fine devices) ────────────────────────────
if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
  const cur = document.getElementById('cur');
  const curR = document.getElementById('cur-r');
  if (cur && curR) {
    let mx = 0, my = 0, rx = 0, ry = 0;
    document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      cur.style.left = mx + 'px'; cur.style.top = my + 'px';
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
    update();
  };
  update();
  if (!reduceMotion) setInterval(() => goTo(si + 1), 6200);
}

// ── REVEAL ON SCROLL ────────────────────────────────────────
if (!reduceMotion) {
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); revealObs.unobserve(e.target); } });
  }, { threshold: 0.08, rootMargin: '0px 0px -52px 0px' });
  document.querySelectorAll('.reveal,.reveal-x,.reveal-r').forEach(el => revealObs.observe(el));
} else {
  document.querySelectorAll('.reveal,.reveal-x,.reveal-r').forEach(el => el.classList.add('vis'));
}

// ── COUNTER ANIMATION ───────────────────────────────────────
if (!reduceMotion) {
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
if (procTrack && !reduceMotion) {
  const procObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { procTrack.classList.add('fill'); procObs.unobserve(procTrack); } });
  }, { threshold: 0.3 });
  procObs.observe(procTrack);
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

// ── CONTACT FORMS — submit to /api/contact via AJAX ─────────
document.querySelectorAll('form#cform, form.cform').forEach(cform => {
  cform.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = cform.querySelector('#fsub, .fsub');
    if (!btn || btn.disabled) return;
    btn.textContent = 'Sending…';
    btn.style.background = '#6B6860';
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
    } catch (err) {
      btn.textContent = 'Something went wrong — please try again.';
      btn.style.background = '';
    }
  });
});
