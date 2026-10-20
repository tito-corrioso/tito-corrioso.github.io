/* ============================================================
   Osmani Tito-Corrioso — site logic
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. Language switch ---------- */
  var root = document.documentElement;
  var langOpts = document.querySelectorAll('.lang-opt');

  function applyLang(lang) {
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);
    try { localStorage.setItem('lang', lang); } catch (e) {}
    langOpts.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
  }

  // Restore persisted language (also done in <head> to prevent flash)
  var saved = 'en';
  try { saved = localStorage.getItem('lang') || 'en'; } catch (e) {}
  applyLang(saved);

  langOpts.forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyLang(btn.dataset.lang);
    });
  });

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
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    // fallback
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
})();