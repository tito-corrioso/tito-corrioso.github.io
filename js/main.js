/* ============================================================
   Osmani Tito-Corrioso — site logic
   ============================================================ */
(function () {
  'use strict';

/* ---------- 1. Language (fixed to English) ---------- */
var root = document.documentElement;
root.setAttribute('data-lang', 'en');
root.setAttribute('lang', 'en');
try { localStorage.removeItem('lang'); } catch (e) {}

  /* ---------- 2. Dropdown menu ---------- */
  var navToggle = document.querySelector('.nav-toggle');
  var navDropdown = document.querySelector('.nav-dropdown');

  if (navToggle && navDropdown) {
    navToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = navDropdown.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.addEventListener('click', function (e) {
      if (!navDropdown.contains(e.target) && e.target !== navToggle) {
        navDropdown.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        navDropdown.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- 3. Scroll reveal ---------- */
var revealEls = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window && revealEls.length) {
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

  // Doble rAF: garantiza que el navegador pintó el estado inicial (opacity 0)
  // antes de añadir .visible, para que la transición SÍ se reproduzca.
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      var vh = window.innerHeight || document.documentElement.clientHeight;

      revealEls.forEach(function (el, i) {
        var rect = el.getBoundingClientRect();

        // ¿Ya está (total o parcialmente) dentro del viewport al cargar?
        var isInViewport = rect.top < vh - 20 && rect.bottom > 0;

        if (isInViewport) {
          // Pequeño stagger para una entrada agradable (máx. 240 ms acumulados)
          var delay = Math.min(i * 60, 240);
          if (delay > 0) {
            el.style.transitionDelay = delay + 'ms';
            el.addEventListener('transitionend', function handler() {
              el.style.transitionDelay = '';
              el.removeEventListener('transitionend', handler);
            });
          }
          el.classList.add('visible');
        } else {
          // Está por debajo del fold: se revelará al hacer scroll
          io.observe(el);
        }
      });
    });
  });
} else {
  // Fallback: sin IntersectionObserver, todo visible
  revealEls.forEach(function (el) { el.classList.add('visible'); });
}

  /* ---------- 4. Back to top ---------- */
  var backBtn = document.querySelector('.back-to-top');
  if (backBtn) {
    window.addEventListener('scroll', function () {
      backBtn.classList.toggle('show', window.scrollY > 400);
    }, { passive: true });
    backBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- 5. Footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* ---------- 6. Menu uppercase ---------- */
  function initMenuUppercase() {
    if (document.getElementById('nx-menu-uppercase')) return;
    var style = document.createElement('style');
    style.id = 'nx-menu-uppercase';
    style.textContent = [
      '.nav-dropdown > li:not(#cv-pdf-li) > a {',
      '  text-transform: uppercase;',
      '  letter-spacing: 0.04em;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }
  initMenuUppercase();
})();
