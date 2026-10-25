/* ============================================================================
   ENHANCE.JS — Mejoras progresivas para el CV de Osmani Tito-Corrioso
   ----------------------------------------------------------------------------
   · Todas las funcionalidades se inyectan en runtime (el HTML no se modifica).
   · cv-pdf.js fetchea el HTML crudo del servidor → el PDF no se ve afectado.
   · Cada módulo está envuelto en try/catch: un fallo no rompe los demás.
   · Desactiva cualquier feature poniendo false en FEATURES.
   ============================================================================ */
(function () {
  'use strict';

  // ============================================================
  // FEATURE FLAGS — pon false para desactivar
  // ============================================================
  const FEATURES = {
    darkMode:        true,   // A
    readingProgress: true,   // B
    heroDownload:    true,   // C
    citations:       true,   // D (APA + Vancouver + BibTeX)
    share:           true,   // E
    paperSearch:     true,   // F
    stickyYears:     true,   // G
    scrollSpy:       true,   // H
    toasts:          true,   // L
    academicBadges:       true,   // Badges ORCID + Google Scholar en el hero
    citationBulkDownload: true    // Descarga masiva en papers.html
  };

  // Páginas que activan buscador y cabeceras sticky (edítalo si añades más)
  const LIST_PAGES = ['papers.html', 'congress.html'];

  // ============================================================
  // UTILIDADES
  // ============================================================
  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };

  function createEl(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function toast(msg) {
    if (!FEATURES.toasts) return;
    let el = document.getElementById('nx-toast');
    if (!el) {
      el = createEl('<div id="nx-toast" role="status" aria-live="polite"></div>');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('nx-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('nx-show'), 2400);
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }

  function currentPage() {
    return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  }

  // ============================================================
  // CSS INYECTADO
  // ============================================================
  function injectCSS() {
    if (document.getElementById('nx-styles')) return;
    const s = document.createElement('style');
    s.id = 'nx-styles';
    s.textContent = `
      /* ---------- Toast ---------- */
      #nx-toast {
        position: fixed;
        left: 50%;
        bottom: 90px;
        transform: translateX(-50%) translateY(20px);
        background: #1e293b;
        color: #fff;
        padding: .7rem 1.2rem;
        border-radius: 8px;
        font-size: .9rem;
        font-weight: 500;
        box-shadow: 0 8px 24px rgba(0,0,0,.25);
        opacity: 0;
        pointer-events: none;
        transition: opacity .25s ease, transform .25s ease;
        z-index: 10000;
        max-width: calc(100vw - 2rem);
      }
      #nx-toast.nx-show { opacity: 1; transform: translateX(-50%) translateY(0); }
      [data-theme="dark"] #nx-toast { background: #475569; }

      /* ---------- Reading progress ---------- */
      .nx-reading-progress {
        position: fixed;
        top: 0; left: 0;
        height: 3px;
        background: linear-gradient(90deg, #f59e0b, #3b82f6);
        z-index: 9999;
        width: 0%;
        transition: width .1s linear;
        pointer-events: none;
      }

      /* ---------- Theme toggle ---------- */
      .nx-theme-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px; height: 38px;
        border-radius: 8px;
        border: 1px solid var(--border, #e2e8f0);
        background: var(--surface, #fff);
        color: var(--text, #1e293b);
        cursor: pointer;
        font-size: 1.1rem;
        transition: all .2s ease;
      }
      .nx-theme-toggle:hover {
        background: var(--primary, #1e40af);
        color: #fff;
        border-color: var(--primary, #1e40af);
      }

      /* ---------- Dark mode ---------- */
      [data-theme="dark"] {
        --bg: #0f172a;
        --surface: #1e293b;
        --text: #e2e8f0;
        --text-muted: #94a3b8;
        --border: #334155;
        --border-strong: #475569;
        --primary: #60a5fa;
        --primary-light: #93c5fd;
        --primary-dark: #3b82f6;
      }
      [data-theme="dark"] body { background: var(--bg); color: var(--text); }
      [data-theme="dark"] .site-header { background: rgba(15,23,42,.93); border-bottom-color: var(--border); }
      [data-theme="dark"] .nav-dropdown { background: var(--surface); border-color: var(--border); }
      [data-theme="dark"] .nav-dropdown a { color: var(--text); }
      [data-theme="dark"] .site-footer { background: #020617; }
      [data-theme="dark"] .card,
      [data-theme="dark"] .entry { background: var(--surface); border-color: var(--border); }
      [data-theme="dark"] .entry-body { color: var(--text); }
      [data-theme="dark"] .entry-body strong { color: var(--primary-light); }
      [data-theme="dark"] .entry-year { color: var(--primary-light); }
      [data-theme="dark"] .about-text p:first-of-type::first-letter { color: var(--primary-light); }
      [data-theme="dark"] .section-title,
      [data-theme="dark"] .card-title { color: var(--primary-light); }
      [data-theme="dark"] .nx-search,
      [data-theme="dark"] .nx-year-filter {
        background: var(--surface);
        color: var(--text);
        border-color: var(--border);
      }
      [data-theme="dark"] .nx-year-header { background: var(--bg); color: var(--primary-light); }
      [data-theme="dark"] .nx-modal-content { background: var(--surface); color: var(--text); border-color: var(--border); }
      [data-theme="dark"] .nx-tab { color: var(--text-muted); }
      [data-theme="dark"] .nx-tab.active { color: var(--primary-light); border-color: var(--primary-light); }
      [data-theme="dark"] .nx-cite-text { background: var(--bg); color: var(--text); border-color: var(--border); }
      [data-theme="dark"] .nx-modal-title { color: var(--primary-light); }

      /* ---------- Hero actions (Download CV) ---------- */
      .nx-hero-actions { margin-top: 1.2rem; display: flex; flex-wrap: wrap; gap: .75rem; }
      .nx-download-cv {
        display: inline-flex;
        align-items: center;
        gap: .5rem;
        padding: .7rem 1.2rem;
        background: #f59e0b;
        color: #1e293b;
        font-weight: 700;
        font-size: .95rem;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(245,158,11,.35);
        transition: all .2s ease;
      }
      .nx-download-cv:hover { background: #fbbf24; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(245,158,11,.5); }
      .nx-download-cv:active { transform: translateY(0); }
      .nx-download-cv svg { width: 18px; height: 18px; }

      /* ---------- Cite button ---------- */
      .nx-cite-actions {
        grid-column: 1 / -1;
        margin-top: .5rem;
        padding-top: .5rem;
        border-top: 1px dashed var(--border, #e2e8f0);
        display: flex;
        justify-content: flex-end;
      }
      .nx-cite-btn {
        display: inline-flex;
        align-items: center;
        gap: .35rem;
        padding: .3rem .75rem;
        font-size: .8rem;
        font-weight: 600;
        color: var(--primary, #1e40af);
        background: transparent;
        border: 1px solid var(--primary, #1e40af);
        border-radius: 6px;
        cursor: pointer;
        transition: all .2s ease;
      }
      .nx-cite-btn:hover { background: var(--primary, #1e40af); color: #fff; }

      /* ---------- Modal ---------- */
      .nx-modal {
        position: fixed;
        inset: 0;
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        opacity: 0;
        pointer-events: none;
        transition: opacity .2s ease;
      }
      .nx-modal.nx-open { opacity: 1; pointer-events: auto; }
      .nx-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15,23,42,.7);
        backdrop-filter: blur(2px);
      }
      .nx-modal-content {
        position: relative;
        background: var(--surface, #fff);
        color: var(--text, #1e293b);
        border-radius: 14px;
        max-width: 640px;
        width: 100%;
        max-height: 85vh;
        overflow: auto;
        padding: 1.5rem 1.5rem 1.2rem;
        box-shadow: 0 20px 60px rgba(0,0,0,.4);
        transform: scale(.95);
        transition: transform .25s cubic-bezier(.34,1.56,.64,1);
      }
      .nx-modal.nx-open .nx-modal-content { transform: scale(1); }
      .nx-modal-close {
        position: absolute;
        top: .75rem;
        right: .75rem;
        width: 32px; height: 32px;
        border-radius: 50%;
        border: none;
        background: var(--border, #e2e8f0);
        color: var(--text, #1e293b);
        font-size: 1.2rem;
        cursor: pointer;
        display: grid;
        place-items: center;
        transition: background .2s ease;
      }
      .nx-modal-close:hover { background: #ef4444; color: #fff; }
      .nx-modal-title {
        font-family: var(--font-serif, Georgia, serif);
        font-size: 1.2rem;
        font-weight: 700;
        color: var(--primary-dark, #1e3a8a);
        margin-bottom: 1rem;
        padding-right: 2.5rem;
      }
      .nx-tabs {
        display: flex;
        gap: .35rem;
        margin-bottom: 1rem;
        border-bottom: 1px solid var(--border, #e2e8f0);
        padding-bottom: .5rem;
        flex-wrap: wrap;
      }
      .nx-tab {
        padding: .4rem .85rem;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--text-muted, #64748b);
        font-weight: 600;
        font-size: .9rem;
        cursor: pointer;
        transition: all .2s ease;
        margin-bottom: -1px;
      }
      .nx-tab:hover { color: var(--primary, #1e40af); }
      .nx-tab.active { color: var(--primary, #1e40af); border-bottom-color: var(--primary, #1e40af); }

      .nx-cite-text {
        background: var(--bg, #f8fafc);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 8px;
        padding: 1rem;
        font-family: 'Courier New', monospace;
        font-size: .82rem;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-x: auto;
        margin-bottom: 1rem;
        color: var(--text, #1e293b);
        max-height: 40vh;
        overflow-y: auto;
      }
      .nx-cite-copy {
        padding: .6rem 1.2rem;
        background: var(--primary, #1e40af);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: .9rem;
        cursor: pointer;
        transition: background .2s ease;
      }
      .nx-cite-copy:hover { background: var(--primary-dark, #1e3a8a); }

      /* ---------- Share button ---------- */
      .nx-share-wrap { margin-top: 1.2rem; }
      .nx-share-btn {
        display: inline-flex;
        align-items: center;
        gap: .4rem;
        padding: .45rem .9rem;
        background: rgba(255,255,255,.2);
        color: #fff;
        border: 1px solid rgba(255,255,255,.4);
        border-radius: 8px;
        font-size: .85rem;
        font-weight: 600;
        cursor: pointer;
        transition: background .2s ease;
      }
      .nx-share-btn:hover { background: rgba(255,255,255,.32); }

      /* ---------- Papers toolbar ---------- */
      .nx-papers-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: .6rem;
        margin-bottom: 1.5rem;
        align-items: center;
        padding: 1rem;
        background: var(--surface, #fff);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: var(--radius, 12px);
      }
      .nx-search {
        flex: 1 1 260px;
        padding: .65rem .9rem;
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 8px;
        font-size: .9rem;
        color: var(--text, #1e293b);
        background: var(--bg, #fff);
        transition: border-color .2s ease;
      }
      .nx-search:focus { outline: none; border-color: var(--primary, #1e40af); }
      .nx-year-filter {
        padding: .65rem .9rem;
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 8px;
        font-size: .9rem;
        background: var(--bg, #fff);
        color: var(--text, #1e293b);
        cursor: pointer;
      }
      .nx-results-count {
        font-size: .85rem;
        color: var(--text-muted, #64748b);
        flex-basis: 100%;
      }

      /* ---------- Year groups ---------- */
      .nx-year-group { margin-bottom: 1.5rem; }
      .nx-year-header {
        position: sticky;
        top: 70px;
        background: var(--bg, #f8fafc);
        color: var(--primary-dark, #1e3a8a);
        font-family: var(--font-serif, Georgia, serif);
        font-size: 1.15rem;
        font-weight: 700;
        padding: .5rem .25rem;
        margin-bottom: .75rem;
        z-index: 5;
        border-bottom: 2px solid #f59e0b;
      }
      .nx-year-header .nx-count {
        font-size: .75rem;
        font-weight: 500;
        color: var(--text-muted, #64748b);
        margin-left: .5rem;
        font-family: var(--font-sans, sans-serif);
      }

      /* ---------- Skip link ---------- */
      .nx-skip-link {
        position: absolute;
        top: -100px;
        left: 8px;
        background: #1e40af;
        color: #fff !important;
        padding: .5rem 1rem;
        border-radius: 0 0 6px 6px;
        font-weight: 600;
        z-index: 99999;
        transition: top .2s ease;
      }
      .nx-skip-link:focus { top: 0; }

      @media (max-width: 640px) {
        .nx-year-header { top: 60px; font-size: 1rem; }
        .nx-modal-content { padding: 1.2rem; max-height: 90vh; }
      }
      @media (prefers-reduced-motion: reduce) {
        #nx-toast, .nx-modal, .nx-modal-content { transition: none; }
      }
      @media print {
        .nx-reading-progress, .nx-theme-toggle, .nx-cite-actions,
        .nx-papers-toolbar, .nx-share-wrap, .nx-hero-actions,
        .nx-year-header, .nx-modal, .nx-skip-link { display: none !important; }
      }
    `;
    document.head.appendChild(s);
  }

  // ============================================================
  // A — DARK MODE
  // ============================================================
  function initDarkMode() {
    const root = document.documentElement;
    const saved = storage.get('nx-theme');
    const prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved || (prefers ? 'dark' : 'light');
    root.setAttribute('data-theme', initial);

    const nav = document.querySelector('.main-nav');
    const navToggle = document.querySelector('.nav-toggle');
    if (!nav || !navToggle) return;

    const btn = createEl('<button class="nx-theme-toggle" type="button" aria-label="Toggle theme">🌙</button>');
    nav.insertBefore(btn, navToggle);

    const update = (theme) => {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.title = btn.getAttribute('aria-label');
    };
    update(initial);

    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      storage.set('nx-theme', next);
      update(next);
    });
  }

  // ============================================================
  // B — READING PROGRESS
  // ============================================================
  function initReadingProgress() {
    const bar = createEl('<div class="nx-reading-progress" aria-hidden="true"></div>');
    document.body.appendChild(bar);

    const update = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      const pct = total > 0 ? (h.scrollTop || document.body.scrollTop) / total * 100 : 0;
      bar.style.width = Math.min(pct, 100) + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  // ============================================================
  // C — HERO DOWNLOAD CV
  // ============================================================
  function initHeroDownload() {
    const hero = document.querySelector('.hero-inner');
    if (!hero || hero.querySelector('.nx-hero-actions')) return;

    const textCol = hero.lastElementChild;
    if (!textCol) return;

    const wrap = createEl(`
      <div class="nx-hero-actions">
        <button type="button" class="nx-download-cv" aria-label="Download CV as PDF">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5H7Zm7 1.5L18.5 9H14V4.5ZM8 13h8v1.5H8V13Zm0 3h8v1.5H8V16Z"/>
          </svg>
          <span>Download CV (PDF)</span>
        </button>
      </div>
    `);
    textCol.appendChild(wrap);

    wrap.querySelector('.nx-download-cv').addEventListener('click', () => {
      // Delegamos en el botón real de cv-pdf.js: misma lógica, mismo resultado
      const pdfBtn = document.querySelector('.cv-pdf-export');
      if (pdfBtn) pdfBtn.click();
      else toast('PDF export not ready. Please try again in a moment.');
    });
  }

  // ============================================================
  // D — CITATIONS: APA / Vancouver / BibTeX
  // ============================================================
  function groupAuthorPairs(raw) {
    const parts = raw.split(/[;,]\s*/).filter(Boolean);
    const grouped = [];
    parts.forEach(p => {
      const t = p.trim();
      const isInitials = /^[A-ZÁÉÍÓÚÑ]\.?(\s*[A-ZÁÉÍÓÚÑ]\.?)*$/.test(t);
      const isParticle = /^(de|van|von|del|la|los|las|da|do|dos|de la)\s/i.test(t);
      if (isInitials && grouped.length) {
        grouped[grouped.length - 1] += ', ' + t;
      } else if (isParticle && grouped.length) {
        grouped[grouped.length - 1] += ' ' + t;
      } else {
        grouped.push(t);
      }
    });
    return grouped.map(g => {
      const m = g.match(/^(.+?),\s*(.+)$/);
      return m ? { surname: m[1].trim(), initials: m[2].trim() } : { surname: g, initials: '' };
    });
  }

  // Reemplaza la función existente 'extractCitationData' por esta:
function extractCitationData(entry) {
  const body = entry.querySelector('.entry-body');
  if (!body) return null;

  const ov = {
    apa:      entry.getAttribute('data-apa'),
    vancouver: entry.getAttribute('data-vancouver'),
    bibtex:   entry.getAttribute('data-bibtex'),
    doi:      entry.getAttribute('data-doi')
  };

  const text = body.textContent.replace(/\s+/g, ' ').trim();
  const ym = text.match(/\((\d{4})\)/);
  const year = ym ? ym[1] : '';
  const authors = ym && ym.index > 0 ? text.slice(0, ym.index).trim().replace(/[,;]\s*$/, '') : '';

  const em = body.querySelector('em');
  const title = em ? em.textContent.trim() : '';

  let journal = '';
  if (em) {
    let n = em.nextSibling;
    while (n) {
      if (n.nodeType === 1 && /^(STRONG|B)$/.test(n.tagName)) {
        journal = n.textContent.trim();
        break;
      }
      n = n.nextSibling;
    }
  }

  let doi = ov.doi || '';
  let url = '';
  // Buscar el DOI en un enlace de doi.org
  const doiLink = body.querySelector('a[href*="doi.org"]');
  if (doiLink) {
    const m = doiLink.href.match(/doi\.org\/(.+)$/);
    if (m && !doi) doi = m[1];
    if (m) url = doiLink.href; // La URL del DOI también sirve como URL del artículo
  }
  
  // Si no se encontró un enlace de DOI, usar el primer enlace disponible (ej. "Download PDF")
  if (!url) {
    const firstLink = body.querySelector('a[href]');
    if (firstLink && firstLink.href && !firstLink.href.startsWith('javascript:')) {
      url = firstLink.href;
    }
  }

  const issnM = text.match(/ISSN[:\s]*([\dX-]{9})/i);

  return { authors, year, title, journal, doi, issn: issnM ? issnM[1] : '', rawText: text, url, ov };
}

  function apaAuthors(raw) {
    const pairs = groupAuthorPairs(raw);
    const out = pairs.map(p => {
      const letters = p.initials.match(/[A-ZÁÉÍÓÚÑ]/g) || [];
      const init = letters.map(l => l + '.').join(' ');
      return p.surname + (init ? ', ' + init : '');
    });
    if (!out.length) return '';
    if (out.length === 1) return out[0];
    if (out.length === 2) return out[0] + ', & ' + out[1];
    return out.slice(0, -1).join(', ') + ', & ' + out[out.length - 1];
  }

  function vancouverAuthors(raw) {
    return groupAuthorPairs(raw).map(p => {
      const letters = (p.initials.match(/[A-ZÁÉÍÓÚÑ]/g) || []).join('');
      return p.surname + (letters ? ' ' + letters : '');
    }).join(', ');
  }

   // Actualiza 'formatAPA' para incluir la URL si no hay DOI
function formatAPA(d) {
  if (d.ov.apa) return d.ov.apa;
  const a = apaAuthors(d.authors) || '[Authors]';
  const y = d.year || 'n.d.';
  const t = d.title || '[Title]';
  const j = d.journal || '[Journal]';
  let link = '';
  if (d.doi) {
    link = ' https://doi.org/' + d.doi;
  } else if (d.url) {
    link = ' ' + d.url;
  }
  return `${a} (${y}). ${t}. ${j}.${link}`;
}

// Actualiza 'formatVancouver' para incluir la URL si no hay DOI
function formatVancouver(d) {
  if (d.ov.vancouver) return d.ov.vancouver;
  const a = vancouverAuthors(d.authors) || '[Authors]';
  const t = d.title || '[Title]';
  const j = d.journal || '[Journal]';
  const y = d.year || '[Year]';
  let link = '';
  if (d.doi) {
    link = ' doi:' + d.doi;
  } else if (d.url) {
    link = ' Available from: ' + d.url;
  }
  return `${a}. ${t}. ${j}. ${y}.${link}`;
}

// Actualiza 'formatBibtex' para añadir el campo 'url' si existe
function formatBibtex(d) {
  if (d.ov.bibtex) return d.ov.bibtex;
  const firstSur = ((d.authors.split(/[,;]/)[0] || 'ref').trim().toLowerCase().replace(/[^a-z]/g, '')) || 'ref';
  const firstWord = ((d.title.split(/\s+/)[0] || 'paper').toLowerCase().replace(/[^a-z]/g, '')) || 'paper';
  const key = firstSur + (d.year || 'xxxx') + firstWord;
  const isConf = /congress|conference|workshop|compumat|proceedings/i.test(d.journal) || /ISBN/i.test(d.rawText);
  const type = isConf ? 'inproceedings' : 'article';
  const field = isConf ? 'booktitle' : 'journal';

  const authorBib = groupAuthorPairs(d.authors)
    .map(p => p.initials ? p.surname + ', ' + p.initials.replace(/[.\s]+/g, '. ') : p.surname)
    .join(' and ');

  let bib = `@${type}{${key},\n`;
  bib += `  author${' '.repeat(6)} = {${authorBib}},\n`;
  bib += `  year${' '.repeat(8)} = {${d.year}},\n`;
  bib += `  title${' '.repeat(7)} = {${d.title}},\n`;
  bib += `  ${field.padEnd(10)} = {${d.journal}}`;
  if (d.doi)  bib += `,\n  doi${' '.repeat(9)} = {${d.doi}}`;
  if (d.issn) bib += `,\n  issn${' '.repeat(8)} = {${d.issn}}`;
  // Añadir el campo URL si está disponible
  if (d.url)  bib += `,\n  url${' '.repeat(9)} = {${d.url}}`;
  bib += `\n}`;
  return bib;
}

  function openCiteModal(entry) {
    const data = extractCitationData(entry);
    if (!data) { toast('Could not read citation data.'); return; }

    const existing = document.querySelector('.nx-modal');
    if (existing) existing.remove();

    const formats = [
      { key: 'apa',       label: 'APA 7th',   text: formatAPA(data) },
      { key: 'vancouver', label: 'Vancouver', text: formatVancouver(data) },
      { key: 'bibtex',    label: 'BibTeX',    text: formatBibtex(data) }
    ];

    const modal = createEl(`
      <div class="nx-modal" role="dialog" aria-modal="true" aria-labelledby="nx-modal-title">
        <div class="nx-modal-backdrop"></div>
        <div class="nx-modal-content">
          <button type="button" class="nx-modal-close" aria-label="Close">&times;</button>
          <h3 class="nx-modal-title" id="nx-modal-title">Cite this paper</h3>
          <div class="nx-tabs" role="tablist"></div>
          <pre class="nx-cite-text"></pre>
          <button type="button" class="nx-cite-copy">Copy to clipboard</button>
        </div>
      </div>
    `);

    const tabsEl = modal.querySelector('.nx-tabs');
    const textEl = modal.querySelector('.nx-cite-text');
    const copyBtn = modal.querySelector('.nx-cite-copy');

    let current = 0;
    formats.forEach((f, i) => {
      const tab = createEl(`<button type="button" class="nx-tab${i === 0 ? ' active' : ''}" role="tab" aria-selected="${i === 0}">${f.label}</button>`);
      tab.addEventListener('click', () => {
        current = i;
        tabsEl.querySelectorAll('.nx-tab').forEach((t, j) => {
          t.classList.toggle('active', j === i);
          t.setAttribute('aria-selected', j === i ? 'true' : 'false');
        });
        textEl.textContent = formats[i].text;
      });
      tabsEl.appendChild(tab);
    });
    textEl.textContent = formats[0].text;

    copyBtn.addEventListener('click', async () => {
      const ok = await copyToClipboard(formats[current].text);
      toast(ok ? 'Copied to clipboard' : 'Copy failed — select text manually');
    });

    const close = () => {
      modal.classList.remove('nx-open');
      setTimeout(() => modal.remove(), 220);
    };
    modal.querySelector('.nx-modal-close').addEventListener('click', close);
    modal.querySelector('.nx-modal-backdrop').addEventListener('click', close);

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('nx-open'));
  }

  function initCitations() {
    if (currentPage() !== 'papers.html') return;

    document.querySelectorAll('.entry').forEach(entry => {
      if (entry.querySelector('.nx-cite-actions')) return;
      const actions = createEl(`<div class="nx-cite-actions"><button type="button" class="nx-cite-btn">📋 Cite</button></div>`);
      actions.querySelector('.nx-cite-btn').addEventListener('click', () => openCiteModal(entry));
      entry.appendChild(actions);
    });

    // Cerrar modal con Escape (una sola vez)
    if (!window.__nxEscBound) {
      window.__nxEscBound = true;
      document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        const m = document.querySelector('.nx-modal');
        if (m) {
          m.classList.remove('nx-open');
          setTimeout(() => m.remove(), 220);
        }
      });
    }
  }

  // ============================================================
  // E — SHARE / COPY LINK
  // ============================================================
  function initShare() {
    const inner = document.querySelector('.page-header-inner');
    if (!inner || inner.querySelector('.nx-share-wrap')) return;

    const wrap = createEl(`<div class="nx-share-wrap"><button type="button" class="nx-share-btn">🔗 Share</button></div>`);
    inner.appendChild(wrap);

    wrap.querySelector('.nx-share-btn').addEventListener('click', async () => {
      const data = { title: document.title, url: location.href };
      if (navigator.share) {
        try { await navigator.share(data); return; } catch {}
      }
      const ok = await copyToClipboard(location.href);
      toast(ok ? 'Link copied to clipboard' : 'Copy failed');
    });
  }

  // ============================================================
  // F + G — SEARCH/FILTER + STICKY YEAR HEADERS
  // ============================================================
  function entryYear(entry) {
    const yEl = entry.querySelector('.entry-year');
    if (!yEl) return '';
    const m = yEl.textContent.match(/(\d{4})/);
    return m ? m[1] : '';
  }

  function initStickyYears() {
    if (!LIST_PAGES.includes(currentPage())) return;
    const list = document.querySelector('main.container .entry-list');
    if (!list || list.querySelector('.nx-year-group')) return;

    const entries = [...list.querySelectorAll(':scope > .entry')];
    if (entries.length < 2 || !entries.every(entryYear)) return;

    const groups = new Map();
    entries.forEach(e => {
      const y = entryYear(e);
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y).push(e);
    });

    const frag = document.createDocumentFragment();
    [...groups.keys()].sort((a, b) => b - a).forEach(year => {
      const grp = document.createElement('div');
      grp.className = 'nx-year-group';
      grp.dataset.year = year;
      const h = document.createElement('h3');
      h.className = 'nx-year-header';
      h.innerHTML = `${year} <span class="nx-count">${groups.get(year).length} ${groups.get(year).length === 1 ? 'item' : 'items'}</span>`;
      grp.appendChild(h);
      groups.get(year).forEach(e => grp.appendChild(e));
      frag.appendChild(grp);
    });

    list.innerHTML = '';
    list.appendChild(frag);
  }

  function initPaperSearch() {
    if (!LIST_PAGES.includes(currentPage())) return;
    const list = document.querySelector('main.container .entry-list');
    if (!list || list.parentNode.querySelector('.nx-papers-toolbar')) return;

    const entries = [...list.querySelectorAll('.entry')];
    if (entries.length < 2 || !entries.every(entryYear)) return;

    const years = [...new Set(entries.map(entryYear))].sort((a, b) => b - a);
    const toolbar = createEl(`
      <div class="nx-papers-toolbar">
        <input type="search" class="nx-search" placeholder="Search…" aria-label="Search entries">
        <select class="nx-year-filter" aria-label="Filter by year">
          <option value="">All years</option>
          ${years.map(y => `<option value="${y}">${y}</option>`).join('')}
        </select>
        <div class="nx-results-count"></div>
      </div>
    `);
    list.parentNode.insertBefore(toolbar, list);

    const searchEl = toolbar.querySelector('.nx-search');
    const yearEl   = toolbar.querySelector('.nx-year-filter');
    const countEl  = toolbar.querySelector('.nx-results-count');

    function applyFilter() {
      const q = searchEl.value.trim().toLowerCase();
      const y = yearEl.value;
      let visible = 0;

      entries.forEach(e => {
        const txt = e.textContent.toLowerCase();
        const matches = (!q || txt.includes(q)) && (!y || entryYear(e) === y);
        e.style.display = matches ? '' : 'none';
        if (matches) visible++;
      });

      list.querySelectorAll('.nx-year-group').forEach(g => {
        const has = [...g.querySelectorAll('.entry')].some(e => e.style.display !== 'none');
        g.style.display = has ? '' : 'none';
      });

      countEl.textContent = visible === entries.length
        ? `Showing all ${entries.length} entries`
        : `Showing ${visible} of ${entries.length} entries`;
    }

    searchEl.addEventListener('input', applyFilter);
    yearEl.addEventListener('change', applyFilter);
    applyFilter();
  }

  // ============================================================
  // H — SCROLL-SPY / aria-current + SKIP LINK
  // ============================================================
  function initScrollSpy() {
    const page = currentPage();
    document.querySelectorAll('.nav-dropdown a').forEach(a => {
      const href = (a.getAttribute('href') || '').split('/').pop().split('#')[0].toLowerCase();
      if (href === page || (page === 'index.html' && href === '')) {
        a.setAttribute('aria-current', 'page');
        a.classList.add('active');
      } else {
        a.removeAttribute('aria-current');
      }
    });

    if (!document.querySelector('.nx-skip-link')) {
      const main = document.querySelector('main') || document.querySelector('.container');
      if (main && !main.id) main.id = 'main';
      const skip = createEl('<a href="#main" class="nx-skip-link">Skip to content</a>');
      document.body.insertBefore(skip, document.body.firstChild);
    }
  }

    // ============================================================
  // ESTILOS EXTRA (solo se inyectan si alguna feature los usa)
  // ============================================================
  function ensureExtraStyles() {
    if (document.getElementById('nx-extra-styles')) return;
    const s = document.createElement('style');
    s.id = 'nx-extra-styles';
    s.textContent = `
      /* ----- Academic badges (hero) ----- */
      .nx-academic-badges {
        display: flex;
        flex-wrap: wrap;
        gap: .55rem;
        margin-top: 1rem;
      }
      .nx-badge {
        display: inline-flex;
        align-items: center;
        gap: .45rem;
        padding: .42rem .85rem;
        background: rgba(255,255,255,.15);
        border: 1px solid rgba(255,255,255,.4);
        color: #fff;
        border-radius: 999px;
        font-size: .82rem;
        font-weight: 600;
        text-decoration: none;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        transition: all .2s ease;
      }
      .nx-badge:hover {
        background: rgba(255,255,255,.3);
        transform: translateY(-2px);
        color: #fff;
      }
      .nx-badge svg { width: 16px; height: 16px; flex-shrink: 0; }
      .nx-badge-orcid   { border-color: rgba(166, 206, 57, .7); }
      .nx-badge-orcid:hover   { background: rgba(166, 206, 57, .35); }
      .nx-badge-scholar { border-color: rgba(66, 133, 244, .7); }
      .nx-badge-scholar:hover { background: rgba(66, 133, 244, .35); }

      /* ----- Bulk citation download ----- */
      .nx-citation-download {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: .6rem;
        padding: .9rem 1.1rem;
        margin-bottom: 1.25rem;
        background: var(--surface, #fff);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: var(--radius, 12px);
      }
      .nx-citation-label {
        font-size: .88rem;
        font-weight: 600;
        color: var(--text-muted, #64748b);
        margin-right: .3rem;
      }
      .nx-cite-dl-btn {
        display: inline-flex;
        align-items: center;
        gap: .4rem;
        padding: .5rem .95rem;
        background: var(--primary, #1e40af);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: .82rem;
        font-weight: 600;
        cursor: pointer;
        transition: all .2s ease;
      }
      .nx-cite-dl-btn:hover {
        background: var(--primary-dark, #1e3a8a);
        transform: translateY(-1px);
      }
      .nx-cite-dl-btn:disabled { opacity: .6; cursor: wait; }
      .nx-cite-dl-bibtex { background: #475569; }
      .nx-cite-dl-bibtex:hover { background: #334155; }

      [data-theme="dark"] .nx-citation-download {
        background: var(--surface);
        border-color: var(--border);
      }
      [data-theme="dark"] .nx-badge {
        background: rgba(255,255,255,.08);
        border-color: rgba(255,255,255,.25);
      }

      @media print {
        .nx-academic-badges, .nx-citation-download { display: none !important; }
      }
    `;
    document.head.appendChild(s);
  }

  // ============================================================
  // ACADEMIC BADGES (hero — ORCID + Google Scholar)
  // ============================================================
  function initAcademicBadges() {
    const hero = document.querySelector('.hero-inner');
    if (!hero || hero.querySelector('.nx-academic-badges')) return;
    const textCol = hero.lastElementChild;
    if (!textCol) return;

    ensureExtraStyles();

    const orcidIcon = `
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947s-.422.947-.947.947a.95.95 0 0 1-.947-.947c0-.525.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.025-5.325 5.025h-3.919V7.416zm1.444 1.303v7.444h2.297c3.272 0 4.022-2.484 4.022-3.722 0-2.016-1.284-3.722-4.097-3.722h-2.222z"/>
      </svg>`;

    const scholarIcon = `
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
      </svg>`;

    const badges = createEl(`
      <div class="nx-academic-badges">
        <a class="nx-badge nx-badge-orcid"
           href="https://orcid.org/0000-0003-4231-7674"
           target="_blank" rel="noopener noreferrer"
           title="ORCID iD: 0000-0003-4231-7674">
          ${orcidIcon}
          <span>ORCID</span>
        </a>
        <a class="nx-badge nx-badge-scholar"
           href="https://scholar.google.com/citations?user=bXhoJuYAAAAJ"
           target="_blank" rel="noopener noreferrer"
           title="Google Scholar profile">
          ${scholarIcon}
          <span>Google Scholar</span>
        </a>
      </div>
    `);

    // Insertar antes del bloque de acciones (Download CV) si existe,
    // para que los badges queden arriba y el botón abajo.
    const actions = textCol.querySelector('.nx-hero-actions');
    if (actions) textCol.insertBefore(badges, actions);
    else textCol.appendChild(badges);
  }

  // ============================================================
  // BULK CITATION DOWNLOAD (papers.html)
  // ============================================================
  function initCitationBulkDownload() {
    if (currentPage() !== 'papers.html') return;
    const list = document.querySelector('main.container .entry-list');
    if (!list) return;
    if (list.parentNode.querySelector('.nx-citation-download')) return;

    ensureExtraStyles();

    const toolbar = createEl(`
      <div class="nx-citation-download">
        <span class="nx-citation-label">Download all citations:</span>
        <button type="button" class="nx-cite-dl-btn" data-format="apa">
          APA
        </button>
        <button type="button" class="nx-cite-dl-btn" data-format="vancouver">
          Vancouver
        </button>
        <button type="button" class="nx-cite-dl-btn nx-cite-dl-bibtex" data-format="bibtex">
          BibTeX
        </button>
      </div>
    `);
    list.parentNode.insertBefore(toolbar, list);

    toolbar.querySelectorAll('.nx-cite-dl-btn').forEach(btn => {
      btn.addEventListener('click', () => downloadAllCitations(btn));
    });
  }

  function downloadAllCitations(btn) {
    const format = btn.dataset.format;
    const originalLabel = btn.textContent.trim();
    btn.disabled = true;
    btn.textContent = 'Preparing…';

    try {
      const entries = [...document.querySelectorAll('.entry')];
      const parts = [];
      let ok = 0;

      entries.forEach((entry, i) => {
        const data = extractCitationData(entry);
        if (!data) return;

        let text = '';
        if (format === 'apa')            text = formatAPA(data);
        else if (format === 'vancouver') text = formatVancouver(data);
        else if (format === 'bibtex')    text = formatBibtex(data);

        if (!text || !text.trim()) return;
        ok++;

        if (format === 'vancouver')      parts.push(`${ok}. ${text}`);
        else                             parts.push(text);
      });

      if (!ok) {
        toast('No citations could be generated.');
        return;
      }

      const content = parts.join('\n\n');
      const isBib = format === 'bibtex';
      const mime = isBib ? 'application/x-bibtex' : 'text/plain';
      const ext = isBib ? 'bib' : 'txt';
      const date = new Date().toISOString().slice(0, 10);
      const filename = `tito-corrioso-citations-${format}-${date}.${ext}`;

      const blob = new Blob([content], { type: mime + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      const fmtLabel = format === 'apa' ? 'APA 7th'
                     : format === 'vancouver' ? 'Vancouver'
                     : 'BibTeX';
      toast(`Downloaded ${ok} citations as ${fmtLabel} (.${ext})`);
    } catch (e) {
      console.warn('[nx] bulk cite:', e);
      toast('Could not generate the citation file.');
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    try { injectCSS(); } catch (e) { console.warn('[nx] CSS:', e); }
    if (FEATURES.darkMode)        try { initDarkMode(); }        catch (e) { console.warn('[nx] dark:', e); }
    if (FEATURES.readingProgress) try { initReadingProgress(); } catch (e) { console.warn('[nx] progress:', e); }
    if (FEATURES.heroDownload)    try { initHeroDownload(); }    catch (e) { console.warn('[nx] hero:', e); }
    if (FEATURES.citations)       try { initCitations(); }       catch (e) { console.warn('[nx] cite:', e); }
    if (FEATURES.share)           try { initShare(); }           catch (e) { console.warn('[nx] share:', e); }
    if (FEATURES.stickyYears)     try { initStickyYears(); }     catch (e) { console.warn('[nx] sticky:', e); }
    if (FEATURES.paperSearch)     try { initPaperSearch(); }     catch (e) { console.warn('[nx] search:', e); }
    if (FEATURES.scrollSpy)       try { initScrollSpy(); }       catch (e) { console.warn('[nx] spy:', e); }
    if (FEATURES.academicBadges) try { initAcademicBadges(); } catch (e) { console.warn('[nx] badges:', e); }
    if (FEATURES.citationBulkDownload) try { initCitationBulkDownload(); } catch (e) { console.warn('[nx] bulk cite:', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
