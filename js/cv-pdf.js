/* ============================================================================
   CV-PDF.JS — Exportación profesional del CV a PDF
   ----------------------------------------------------------------------------
   - Añade al menú desplegable un selector de idioma (EN/ES) + botón "Download"
   - Fetch de todas las secciones desde sus URLs (education, work, projects,
     courses, thesis, awards, congress, papers)
   - Cabecera: foto (izq, más grande) · nombre / PhD / Curriculum Vitae / fecha
     (centro) · QR (der, más pequeño) — el QR solo aparece en el PDF
   - Orden: header → perfil → datos personales → education → work → projects
     → courses → thesis → awards → congress → papers
   - Traducción EN→ES vía MyMemory para las secciones traducibles.
     Papers y Congress se mantienen SIEMPRE en su idioma original.
   ============================================================================ */
(function () {
  'use strict';

  // ==========================================================================
  // CONFIGURACIÓN
  // ==========================================================================
  const CONFIG = {
    name: 'Osmani Tito-Corrioso',
    title: 'PhD. in Mathematical Science',
    cvLabel: 'Curriculum Vitae',
    photo: 'img/otc.jpg',
    qr: 'img/QR.jpg',
    website: 'https://tito-corrioso.github.io/',
    // Orden de secciones en el PDF (papers y congress al final, según pedido)
    sections: [
      { key: 'education', file: 'education.html', titleEn: 'Education',            titleEs: 'Educación',               translate: true  },
      { key: 'work',      file: 'work.html',      titleEn: 'Work experience',      titleEs: 'Experiencia laboral',     translate: true  },
      { key: 'projects',  file: 'projects.html',  titleEn: 'Projects',             titleEs: 'Proyectos',               translate: true  },
      { key: 'courses',   file: 'courses.html',   titleEn: 'Courses',              titleEs: 'Cursos',                  translate: true  },
      { key: 'thesis',    file: 'thesis.html',    titleEn: 'Thesis',               titleEs: 'Tesis',                   translate: true  },
      { key: 'awards',    file: 'awards.html',    titleEn: 'Awards & acknowledgments', titleEs: 'Premios y reconocimientos', translate: true },
      { key: 'congress',  file: 'congress.html',  titleEn: 'Congress',             titleEs: 'Congresos',               translate: false },
      { key: 'papers',    file: 'papers.html',    titleEn: 'Papers',               titleEs: 'Publicaciones',           translate: false }
    ]
  };

  // ==========================================================================
  // ESTADO
  // ==========================================================================
  const translationCache = new Map();
  let isExporting = false;

  // ==========================================================================
  // TRADUCCIÓN (MyMemory, gratuita, sin key)
  // ==========================================================================
  async function translate(text, targetLang) {
    if (!text || targetLang === 'en') return text;
    const key = targetLang + '|' + text;
    if (translationCache.has(key)) return translationCache.get(key);

    const q = text.slice(0, 500);
    const url = 'https://api.mymemory.translated.net/get?q=' +
      encodeURIComponent(q) + '&langpair=en|' + targetLang;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const r = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      let result = text;
      const t = j && j.responseData && j.responseData.translatedText;
      if (t && !/PLEASE SELECT TWO DISTINCT|MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) {
        result = t;
      }
      translationCache.set(key, result);
      return result;
    } catch {
      translationCache.set(key, text); // cacheamos el fallback también
      return text;
    }
  }

  async function translateContainer(container, targetLang, onProgress) {
    if (targetLang === 'en') return;

    // Recolecta todos los nodos de texto traducibles
    const textNodes = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        let el = node.parentElement;
        while (el && el !== container) {
          if (el.dataset && el.dataset.noTranslate === 'true') {
            return NodeFilter.FILTER_REJECT;
          }
          el = el.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    const total = textNodes.length;
    if (!total) { if (onProgress) onProgress(0, 0); return; }

    const CONCURRENCY = 4;
    let cursor = 0;
    let done = 0;

    async function worker() {
      while (cursor < textNodes.length) {
        const idx = cursor++;
        const node = textNodes[idx];
        const original = node.nodeValue;
        const leading = original.match(/^\s*/)[0];
        const trailing = original.match(/\s*$/)[0];
        const trimmed = original.trim();
        try {
          const translated = await translate(trimmed, targetLang);
          if (translated && translated !== trimmed) {
            node.nodeValue = leading + translated + trailing;
          }
        } catch {}
        done++;
        if (onProgress) onProgress(done, total);
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  // ==========================================================================
  // EXTRACCIÓN DE CONTENIDO DEL DOM ACTUAL (index)
  // ==========================================================================
  // Devuelve el texto visible del elemento en el idioma pedido, eliminando
  // los <span lang="xx"> que no correspondan.
  function pickLang(el, lang) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('[lang]').forEach(s => {
      if (s.getAttribute('lang') !== lang) s.remove();
    });
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }

  function extractProfileFromDoc(doc, lang) {
    const result = [];
    doc.querySelectorAll('.about-text p[lang]').forEach(p => {
      if (p.getAttribute('lang') === lang) {
        const t = p.textContent.replace(/\s+/g, ' ').trim();
        if (t) result.push(t);
      }
    });
    return result;
  }

  function extractSidebarFromDoc(doc, lang) {
    const cards = [];
    doc.querySelectorAll('aside .card').forEach(card => {
      const titleEl = card.querySelector('.card-title');
      if (!titleEl) return;
      const title = pickLang(titleEl, lang);
      const tLower = title.toLowerCase();
      // Saltamos tarjetas irrelevantes para el PDF
      if (tLower.includes('visit')) return;
      if (tLower.includes('erd')) return;
      if (tLower.includes('web')) return;

      const items = [];
      card.querySelectorAll('li').forEach(li => {
        const link = li.querySelector('a[href]');
        const text = pickLang(li, lang);
        if (!text) return;
        items.push(link ? { text, href: link.href } : { text });
      });
      if (items.length) cards.push({ title, items });
    });
    return cards;
  }

  // ==========================================================================
  // FETCH DE SECCIONES
  // ==========================================================================
  async function fetchDoc(file) {
    const candidates = [file, 'resources/' + file];
    if (file === 'courses.html') candidates.push('cources.html', 'resources/cources.html');

    for (const url of candidates) {
      try {
        const r = await fetch(url, { cache: 'no-cache' });
        if (r.ok) {
          const html = await r.text();
          return new DOMParser().parseFromString(html, 'text/html');
        }
      } catch {}
    }
    throw new Error('No se pudo cargar ' + file);
  }

  async function fetchIndexDoc() {
    return fetchDoc('index.html');
  }

  function getSectionGroup(entryEl) {
    let el = entryEl;
    while (el) {
      if (el.classList && el.classList.contains('section')) break;
      el = el.parentElement;
    }
    if (el) {
      const h = el.querySelector('.section-title');
      if (h) return h.textContent.trim();
    }
    return null;
  }

  function parseEntries(doc) {
    const entries = [];
    doc.querySelectorAll('.entry').forEach(entryEl => {
      const yearEl = entryEl.querySelector('.entry-year');
      const bodyEl = entryEl.querySelector('.entry-body');
      if (!bodyEl) return;
      entries.push({
        year: yearEl ? yearEl.textContent.trim() : '',
        html: bodyEl.innerHTML.trim(),
        sectionGroup: getSectionGroup(entryEl)
      });
    });
    return entries;
  }

  // ==========================================================================
  // ESPERAR IMÁGENES
  // ==========================================================================
  function waitForImages(root, timeoutMs = 5000) {
    const imgs = Array.from(root.querySelectorAll('img'));
    if (!imgs.length) return Promise.resolve();
    return Promise.all(imgs.map(img => new Promise(resolve => {
      if (img.complete && img.naturalWidth > 0) return resolve();
      const done = () => { img.onload = img.onerror = null; resolve(); };
      img.onload = done;
      img.onerror = done;
      setTimeout(done, timeoutMs);
    })));
  }

  // ==========================================================================
  // CONSTRUCCIÓN DEL HTML DEL CV
  // ==========================================================================
  async function buildCvRoot(lang, onProgress) {
    const isEs = lang === 'es';
    const root = document.createElement('div');
    root.className = 'cv-root';

    // ---------- Datos del index (perfil + sidebar) ----------
    let profile, sidebar;
    if (document.querySelector('.about-text') && document.querySelector('aside .card')) {
      // Estamos en index.html → usar DOM local (más rápido y fiable)
      profile = extractProfileFromDoc(document, lang);
      sidebar = extractSidebarFromDoc(document, lang);
    } else {
      // Estamos en otra página → fetch de index.html
      try {
        const idxDoc = await fetchIndexDoc();
        profile = extractProfileFromDoc(idxDoc, lang);
        sidebar = extractSidebarFromDoc(idxDoc, lang);
      } catch {
        profile = [];
        sidebar = [];
      }
    }

    // ---------- CABECERA ----------
    const dateStr = new Date().toLocaleDateString(
      isEs ? 'es-ES' : 'en-GB',
      { day: 'numeric', month: 'long', year: 'numeric' }
    );
    const header = document.createElement('header');
    header.className = 'cv-header';
    header.dataset.noTranslate = 'true'; // ya construido en idioma correcto
    header.innerHTML = `
      <div class="cv-header-left">
        <img src="${CONFIG.photo}" alt="Photo" class="cv-photo">
      </div>
      <div class="cv-header-center">
        <h1 class="cv-name">${CONFIG.name}</h1>
        <p class="cv-title">${CONFIG.title}</p>
        <p class="cv-label">${CONFIG.cvLabel}</p>
        <p class="cv-date">${isEs ? 'Actualizado' : 'Updated'}: ${dateStr}</p>
      </div>
      <div class="cv-header-right">
        <img src="${CONFIG.qr}" alt="QR" class="cv-qr">
      </div>
    `;
    root.appendChild(header);

    // ---------- PERFIL ----------
    if (profile.length) {
      const sec = document.createElement('section');
      sec.className = 'cv-section';
      sec.dataset.noTranslate = 'true'; // ya viene en el idioma correcto
      sec.innerHTML = `<h2 class="cv-section-title">${isEs ? 'Perfil profesional' : 'Professional profile'}</h2>`;
      profile.forEach(text => {
        const p = document.createElement('p');
        p.textContent = text;
        sec.appendChild(p);
      });
      root.appendChild(sec);
    }

    // ---------- SIDEBAR ----------
    if (sidebar.length) {
      const sec = document.createElement('section');
      sec.className = 'cv-section';
      sec.dataset.noTranslate = 'true';
      sec.innerHTML = `<h2 class="cv-section-title">${isEs ? 'Datos profesionales y personales' : 'Professional & personal details'}</h2>`;
      const grid = document.createElement('div');
      grid.className = 'cv-sidebar-grid';
      sidebar.forEach(card => {
        const col = document.createElement('div');
        col.className = 'cv-sidebar-col';
        const h = document.createElement('h3');
        h.textContent = card.title;
        col.appendChild(h);
        const ul = document.createElement('ul');
        card.items.forEach(item => {
          const li = document.createElement('li');
          if (item.href) {
            const a = document.createElement('a');
            a.href = item.href;
            a.textContent = item.text;
            li.appendChild(a);
          } else {
            li.textContent = item.text;
          }
          ul.appendChild(li);
        });
        col.appendChild(ul);
        grid.appendChild(col);
      });
      sec.appendChild(grid);
      root.appendChild(sec);
    }

    // ---------- SECCIONES (fetch + parseo) ----------
    const totalSections = CONFIG.sections.length;
    const translatableSectionEls = [];

    for (let i = 0; i < totalSections; i++) {
      const s = CONFIG.sections[i];
      if (onProgress) onProgress({
        phase: 'fetch',
        current: i + 1,
        total: totalSections,
        label: isEs ? s.titleEs : s.titleEn
      });

      const sec = document.createElement('section');
      sec.className = 'cv-section';

      try {
        const doc = await fetchDoc(s.file);
        const entries = parseEntries(doc);
        if (!entries.length) continue;

        const title = isEs ? s.titleEs : s.titleEn;
        sec.innerHTML = `<h2 class="cv-section-title" data-no-translate="true">${title}</h2>`;
        const list = document.createElement('div');
        list.className = 'cv-entries';

        let currentGroup = null;
        entries.forEach(entry => {
          if (entry.sectionGroup && entry.sectionGroup !== currentGroup) {
            currentGroup = entry.sectionGroup;
            const groupH = document.createElement('h3');
            groupH.className = 'cv-subsection-title';
            groupH.textContent = entry.sectionGroup;
            if (!s.translate) groupH.dataset.noTranslate = 'true';
            list.appendChild(groupH);
          }
          const el = document.createElement('div');
          el.className = 'cv-entry';
          if (!s.translate) el.dataset.noTranslate = 'true';
          el.innerHTML = `
            <div class="cv-entry-year">${entry.year || ''}</div>
            <div class="cv-entry-body">${entry.html}</div>
          `;
          list.appendChild(el);
        });

        sec.appendChild(list);
        root.appendChild(sec);

        if (s.translate) translatableSectionEls.push(sec);
      } catch (err) {
        console.warn('[cv-pdf] Error cargando ' + s.file, err);
        const title = isEs ? s.titleEs : s.titleEn;
        sec.innerHTML = `
          <h2 class="cv-section-title" data-no-translate="true">${title}</h2>
          <p style="color:#94a3b8;font-style:italic;font-size:9pt;">
            (${isEs ? 'Sección no disponible' : 'Section not available'})
          </p>
        `;
        root.appendChild(sec);
      }
    }

    // ---------- TRADUCCIÓN (solo secciones marcadas) ----------
    if (lang !== 'en' && translatableSectionEls.length) {
      if (onProgress) onProgress({ phase: 'translate', current: 0, total: 0 });

      // Ejecutamos todas las secciones traducibles en paralelo
      await Promise.all(translatableSectionEls.map(secEl =>
        translateContainer(secEl, lang, (done, total) => {
          if (onProgress) onProgress({ phase: 'translate', current: done, total });
        })
      ));
    }

    // ---------- PIE ----------
    const footer = document.createElement('footer');
    footer.className = 'cv-footer';
    footer.dataset.noTranslate = 'true';
    footer.textContent = CONFIG.website;
    root.appendChild(footer);

    return root;
  }

  // ==========================================================================
  // ESTILOS (del PDF + de la UI del menú)
  // ==========================================================================
  function injectStyles() {
    if (document.getElementById('cv-pdf-styles')) return;
    const style = document.createElement('style');
    style.id = 'cv-pdf-styles';
    style.textContent = `
      #cv-pdf-mount,
#cv-pdf-mount *,
.cv-root,
.cv-root * {
  overflow: visible !important;
  float: none !important;
  opacity: 1 !important;
  visibility: visible !important;
  animation: none !important;
  transition: none !important;
}
      .cv-root {
        font-family: 'Inter', Arial, Helvetica, sans-serif;
        font-size: 10pt;
        color: #1e293b;
        line-height: 1.5;
        background: #ffffff;
        padding: 0;
      }

      /* Cabecera */
      .cv-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding-bottom: 14px;
        border-bottom: 3px solid #1e40af;
        margin-bottom: 18px;
      }
      .cv-header-left, .cv-header-right { flex: 0 0 auto; }
      .cv-header-center { flex: 1 1 auto; text-align: center; padding: 0 10px; }
      .cv-photo {
        width: 120px; height: 120px;
        border-radius: 50%;
        border: 3px solid #1e40af;
        object-fit: cover;
        display: block;
      }
      .cv-qr {
        width: 90px; height: 90px;
        object-fit: contain;
        display: block;
      }
      .cv-name {
        font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
        font-size: 22pt; font-weight: 700;
        color: #1e3a8a;
        margin: 0 0 4px 0; line-height: 1.15;
      }
      .cv-title {
        font-size: 11pt; font-weight: 600;
        color: #1e40af; margin: 0 0 2px 0;
      }
      .cv-label {
        font-size: 9pt; color: #64748b;
        text-transform: uppercase; letter-spacing: 0.15em;
        margin: 2px 0;
      }
      .cv-date { font-size: 8.5pt; color: #64748b; margin: 0; }

      /* Secciones */
      .cv-section { margin-bottom: 16px; }
      .cv-section-title {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 13.5pt; font-weight: 700;
        color: #1e3a8a;
        border-bottom: 2px solid #f59e0b;
        padding-bottom: 3px; margin: 0 0 10px 0;
      }
      .cv-section p {
        margin: 0 0 8px 0;
        text-align: justify;
        font-size: 9.5pt; line-height: 1.55;
      }
      .cv-subsection-title {
        font-size: 10.5pt; font-weight: 700;
        color: #1e40af;
        margin: 10px 0 6px 0; padding-bottom: 2px;
        border-bottom: 1px dashed #cbd5e1;
      }

      /* Grid de sidebar */
      .cv-sidebar-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
      }
      .cv-sidebar-col h3 {
        font-size: 10pt; font-weight: 700;
        color: #1e40af; margin: 0 0 4px 0;
      }
      .cv-sidebar-col ul { list-style: disc; padding-left: 14px; margin: 0; }
      .cv-sidebar-col li {
        font-size: 9pt; margin-bottom: 2px; line-height: 1.4;
        overflow-wrap: anywhere;
      }
      .cv-sidebar-col a { color: #1e40af; text-decoration: none; }

      /* Entradas (dos columnas: año | cuerpo) */
      .cv-entry {
        display: grid;
        grid-template-columns: 90px 1fr;
        gap: 12px;
        padding: 6px 0;
        border-bottom: 1px solid #e2e8f0;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .cv-entry:last-child { border-bottom: none; }
      .cv-entry-year {
        font-weight: 700; font-size: 9pt;
        color: #1e40af; line-height: 1.4;
      }
      .cv-entry-body {
        font-size: 9.5pt; line-height: 1.5;
        overflow-wrap: anywhere;
      }
      .cv-entry-body strong { color: #1e3a8a; }
      .cv-entry-body em { color: #475569; }
      .cv-entry-body a {
        color: #1e40af; text-decoration: none;
        font-size: 8.5pt; font-weight: 600;
      }
      .cv-footer {
        margin-top: 20px; padding-top: 8px;
        border-top: 1px solid #cbd5e1;
        text-align: center; font-size: 8pt; color: #64748b;
      }

      /* ============ UI DEL MENÚ ============ */
      .cv-pdf-box {
        padding: 10px 12px;
        background: #f8fafc;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        margin: 4px 6px;
      }
      .cv-pdf-box-label {
        display: block; font-size: 10px;
        text-transform: uppercase; letter-spacing: 0.08em;
        color: #64748b; font-weight: 700; margin-bottom: 6px;
      }
      .cv-pdf-box-row { display: flex; gap: 6px; align-items: stretch; }
      .cv-pdf-lang {
        flex: 0 0 auto;
        padding: 6px 8px;
        border: 1px solid #cbd5e1; border-radius: 6px;
        background: #fff; font-size: 13px; color: #1e293b;
        cursor: pointer; outline: none;
      }
      .cv-pdf-lang:focus { border-color: #1e40af; }
      .cv-pdf-export {
        flex: 1 1 auto;
        display: inline-flex; align-items: center; justify-content: center;
        gap: 6px;
        padding: 6px 12px;
        background: #1e40af; color: #fff;
        border: none; border-radius: 6px;
        font-size: 13px; font-weight: 600;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .cv-pdf-export:hover { background: #1e3a8a; }
      .cv-pdf-export:disabled { opacity: 0.6; cursor: not-allowed; }
      .cv-pdf-status {
        margin-top: 6px; font-size: 11px;
        color: #64748b; min-height: 14px;
        line-height: 1.3; display: none;
      }
      .cv-pdf-status.show { display: block; }
      .cv-pdf-status.error { color: #dc2626; }

      /* ============ OVERLAY / SPINNER ============ */
      #cv-pdf-overlay {
        position: fixed; inset: 0;
        background: rgba(248, 250, 252, 0.96);
        -webkit-backdrop-filter: blur(4px);
        backdrop-filter: blur(4px);
        z-index: 99999;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Inter', -apple-system, sans-serif;
      }
      #cv-pdf-overlay .cv-pdf-spinner {
        width: 44px; height: 44px;
        border: 4px solid #e2e8f0;
        border-top-color: #1e40af;
        border-radius: 50%;
        animation: cvpdf-spin 1s linear infinite;
        margin: 0 auto 14px;
      }
      #cv-pdf-overlay .cv-pdf-overlay-text {
        font-size: 15px; font-weight: 600; color: #1e40af;
        text-align: center; padding: 0 20px;
      }
      @keyframes cvpdf-spin { to { transform: rotate(360deg); } }

      @media print {
        .cv-pdf-box, #cv-pdf-overlay { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  // ==========================================================================
// HELPERS nuevos
// ==========================================================================
function loadScript(url) {
  if (!url) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar ' + url));
    document.head.appendChild(s);
  });
}

function createToast(message) {
  const t = document.createElement('div');
  t.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: #1e40af; color: #fff; padding: 12px 24px;
    border-radius: 8px; font: 600 14px/1.4 'Inter', sans-serif;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25); z-index: 2147483647;
    max-width: 90vw; text-align: center;
  `;
  t.textContent = message;
  return t;
}

// ==========================================================================
// GENERACIÓN DEL PDF (html2canvas + jsPDF, sin html2pdf)
// ==========================================================================
async function generatePdf(lang, onProgress) {
  // 1. Cargar librerías por separado (solo si no están ya cargadas)
  await Promise.all([
    window.html2canvas
      ? null
      : loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
    (window.jspdf && window.jspdf.jsPDF)
      ? null
      : loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  ]);

  injectStyles();

  // 2. Construir el DOM del CV (esto ya lo hacía buildCvRoot)
  const cvRoot = await buildCvRoot(lang, onProgress);

  // 3. Toast (mensaje abajo al centro, NO cubre el contenido)
  const toast = createToast(lang === 'es' ? 'Generando PDF…' : 'Generating PDF…');
  document.body.appendChild(toast);

  // 4. Montar el CV VISIBLE en pantalla, esquina superior izquierda
  const mount = document.createElement('div');
  mount.id = 'cv-pdf-mount';
  mount.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 794px;
    background: #ffffff;
    z-index: 999998;
    margin: 0;
    padding: 0;
    overflow: visible;
    pointer-events: none;
    box-shadow: 0 0 40px rgba(0,0,0,0.15);
  `;
  mount.appendChild(cvRoot);
  document.body.appendChild(mount);

  try {
    // 5. Esperar imágenes + un margen para el layout
    await waitForImages(cvRoot, 10000);
    await new Promise(r => setTimeout(r, 400));

    // 6. Diagnóstico en consola (nos dirá si algo falla)
    const rect = mount.getBoundingClientRect();
    const diagnostics = {
      mountWidth: Math.round(rect.width),
      mountHeight: Math.round(rect.height),
      childNodes: mount.querySelectorAll('*').length,
      textLength: mount.textContent.trim().length
    };
    console.log('[cv-pdf] Diagnóstico:', diagnostics);

    if (diagnostics.mountHeight < 100) {
      throw new Error(
        'El contenido del CV tiene solo ' + diagnostics.mountHeight + 'px de alto. ' +
        'buildCvRoot() no generó contenido — revisa los errores de fetch en la consola.'
      );
    }
    if (diagnostics.textLength < 100) {
      throw new Error(
        'El CV tiene solo ' + diagnostics.textLength + ' caracteres. ' +
        'Probablemente las secciones fallaron al cargarse.'
      );
    }

    // 7. Capturar con html2canvas directamente
    const canvas = await window.html2canvas(mount, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      foreignObjectRendering: false,
      removeContainer: true,
      imageTimeout: 15000,
      scrollX: 0,
      scrollY: 0
    });
    console.log('[cv-pdf] Canvas capturado:', canvas.width, '×', canvas.height);

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas vacío (0×0). html2canvas no pudo capturar el mount.');
    }

    // 8. Comprobar que el canvas NO es todo blanco (detecta fallo silencioso)
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(
      Math.floor(canvas.width / 4),
      Math.floor(canvas.height / 4),
      Math.floor(canvas.width / 2),
      Math.floor(canvas.height / 2)
    ).data;
    let nonWhite = 0;
    for (let i = 0; i < data.length; i += 40) {
      if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) nonWhite++;
    }
    console.log('[cv-pdf] Píxeles no-blancos en muestra:', nonWhite);
    if (nonWhite === 0) {
      console.warn('[cv-pdf] ⚠ El canvas parece blanco. Revisa opacity/visibility/overflow.');
    }

    // 9. Construir el PDF multipágina con jsPDF
    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL('image/jpeg', 0.9);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const contentW = pdfW - 2 * margin;
    const contentH = pdfH - 2 * margin;
    const imgH = (canvas.height * contentW) / canvas.width;

    let remaining = imgH;

    // Página 1
    pdf.addImage(imgData, 'JPEG', margin, margin, contentW, imgH);
    remaining -= contentH;

    // Páginas siguientes
    while (remaining > 0.5) {
      pdf.addPage();
      const y = margin - (imgH - remaining);
      pdf.addImage(imgData, 'JPEG', margin, y, contentW, imgH);
      remaining -= contentH;
    }

    console.log('[cv-pdf] Páginas generadas:', pdf.internal.getNumberOfPages());
    pdf.save(`CV_Osmani_Tito-Corrioso_${lang.toUpperCase()}.pdf`);
    console.log('[cv-pdf] ✓ PDF guardado');

  } finally {
    if (toast.parentNode) document.body.removeChild(toast);
    if (mount.parentNode) document.body.removeChild(mount);
  }
}
   
  // ==========================================================================
  // UI: PANEL EN EL MENÚ
  // ==========================================================================
  function createUi() {
    const dropdown = document.querySelector('.nav-dropdown');
    if (!dropdown) return;
    if (document.getElementById('cv-pdf-li')) return;

    const li = document.createElement('li');
    li.id = 'cv-pdf-li';
    li.style.cssText = 'border-top:1px solid #e2e8f0;margin-top:6px;padding-top:6px;';

    li.innerHTML = `
      <div class="cv-pdf-box">
        <label class="cv-pdf-box-label">
          <span lang="en">Export CV</span>
          <span lang="es">Exportar CV</span>
        </label>
        <div class="cv-pdf-box-row">
          <select class="cv-pdf-lang" aria-label="PDF language">
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
          <button type="button" class="cv-pdf-export">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M7 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5H7Zm7 1.5L18.5 9H14V4.5ZM8 13h8v1.5H8V13Zm0 3h8v1.5H8V16Z"/>
            </svg>
            <span lang="en">Download PDF</span>
            <span lang="es">Descargar PDF</span>
          </button>
        </div>
        <div class="cv-pdf-status" role="status" aria-live="polite"></div>
      </div>
    `;
    dropdown.appendChild(li);

    const select = li.querySelector('.cv-pdf-lang');
    const btn = li.querySelector('.cv-pdf-export');
    const statusEl = li.querySelector('.cv-pdf-status');

    // Inicializa con el idioma actual del sitio
    select.value = (document.documentElement.getAttribute('data-lang') === 'es') ? 'es' : 'en';

    function setStatus(text, isError) {
      statusEl.textContent = text || '';
      statusEl.classList.toggle('show', !!text);
      statusEl.classList.toggle('error', !!isError);
    }

    function setOverlayText(text) {
      const t = document.getElementById('cvpdf-overlay-text');
      if (t) t.textContent = text;
    }

    btn.addEventListener('click', async () => {
      if (isExporting) return;
      isExporting = true;
      btn.disabled = true;
      setStatus('');

      const lang = select.value === 'es' ? 'es' : 'en';
      const isEs = lang === 'es';

      // Cierra el menú
      const navDropdown = document.querySelector('.nav-dropdown');
      if (navDropdown) navDropdown.classList.remove('open');

      const onProgress = (info) => {
        if (info.phase === 'fetch') {
          const msg = (isEs ? 'Cargando ' : 'Loading ') + info.label +
                      ' (' + info.current + '/' + info.total + ')';
          setStatus(msg);
          setOverlayText(msg);
        } else if (info.phase === 'translate') {
          const msg = (info.total > 0)
            ? (isEs ? 'Traduciendo… ' : 'Translating… ') + info.current + '/' + info.total
            : (isEs ? 'Traduciendo…' : 'Translating…');
          setStatus(msg);
          setOverlayText(msg);
        }
      };

      try {
        await generatePdf(lang, onProgress);
        setStatus(isEs ? '✓ PDF descargado' : '✓ PDF downloaded');
        setTimeout(() => setStatus(''), 4000);
      } catch (err) {
        console.error('[cv-pdf]', err);
        setStatus((isEs ? 'Error: ' : 'Error: ') + err.message, true);
      } finally {
        isExporting = false;
        btn.disabled = false;
      }
    });
  }

  // ==========================================================================
  // INICIALIZACIÓN
  // ==========================================================================
  function init() { createUi(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
