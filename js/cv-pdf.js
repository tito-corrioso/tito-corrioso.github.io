/* ============================================================================
   CV-PDF.JS v4 — Exportación profesional del CV a PDF (texto vectorial real)
   ----------------------------------------------------------------------------
   Migración de html2canvas+jsPDF (imagen) a pdfmake (texto vectorial real).
   
   Conservado del código anterior:
   - CONFIG (con secciones y orden respetados)
   - Sistema de traducción MyMemory (translate, translateContainer)
   - Extracción de datos (pickLang, extractProfileFromDoc, extractSidebarFromDoc)
   - Fetch de secciones con fallback a resources/
   - Interfaz de progreso (onProgress con fases fetch/translate)
   - Panel UI del menú (createUi) y sus estilos
   
   Nuevo:
   - PDF con texto seleccionable, buscable y copiable
   - Links clickables en "Personal details" (mailto, WhatsApp) y "Web sites"
   - Foto circular arriba-izquierda, QR arriba-derecha (solo en PDF)
   - Márgenes fijos (15mm izq/der, 20mm arriba, 22mm abajo)
   - Footer con URL del sitio + "N / total" en cada página
   - Papers y Congress siempre en idioma original
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
    sections: [
      { key: 'education', file: 'education.html', titleEn: 'Education',               titleEs: 'Educación',                 translate: true  },
      { key: 'work',      file: 'work.html',      titleEn: 'Work experience',         titleEs: 'Experiencia laboral',       translate: true  },
      { key: 'projects',  file: 'projects.html',  titleEn: 'Projects',                titleEs: 'Proyectos',                 translate: true  },
      { key: 'courses',   file: 'courses.html',   titleEn: 'Courses',                 titleEs: 'Cursos',                    translate: true  },
      { key: 'thesis',    file: 'thesis.html',    titleEn: 'Thesis',                  titleEs: 'Tesis',                     translate: true  },
      { key: 'awards',    file: 'awards.html',    titleEn: 'Awards & acknowledgments', titleEs: 'Premios y reconocimientos', translate: true  },
      { key: 'congress',  file: 'congress.html',  titleEn: 'Congress',                titleEs: 'Congresos',                 translate: false },
      { key: 'papers',    file: 'papers.html',    titleEn: 'Papers',                  titleEs: 'Publicaciones',             translate: false }
    ]
  };

  // ==========================================================================
  // ESTADO
  // ==========================================================================
  const translationCache = new Map();
  let isExporting = false;

  // ==========================================================================
  // CARGA DE LIBRERÍAS
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

  async function loadPdfLibraries() {
  // 1) pdfmake primero
  if (!window.pdfMake || typeof window.pdfMake.createPdf !== 'function') {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js');
  }
  // 2) vfs_fonts después, en secuencia
  if (!window.pdfMake || !window.pdfMake.vfs) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js');
  }
  // 3) Verificación
  if (!window.pdfMake || typeof window.pdfMake.createPdf !== 'function') {
    throw new Error('pdfmake no se cargó correctamente');
  }
  if (!window.pdfMake.vfs) {
    throw new Error('vfs_fonts.js no se cargó correctamente');
  }
}
   
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
      translationCache.set(key, text);
      return text;
    }
  }

  async function translateContainer(container, targetLang, onProgress) {
    if (targetLang === 'en') return;

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
  // EXTRACCIÓN DE CONTENIDO
  // ==========================================================================
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
      // Excluidos del PDF: visitas y número de Erdős
      if (tLower.includes('visit')) return;
      if (tLower.includes('erd')) return;
      // "Web sites" SÍ se incluye (links clickables en el PDF)

      const items = [];
      card.querySelectorAll('li').forEach(li => {
        const link = li.querySelector('a[href]');
        const text = pickLang(li, lang);
        if (!text) return;

        let href = null;
        if (link) {
          const raw = (link.getAttribute('href') || '').trim();
          if (raw && raw !== '#' && !raw.startsWith('javascript:')) {
            href = link.href;
          }
        }
        // Fallback: inferir mailto / WhatsApp si no hay href válido
        if (!href) {
          if (text.includes('@') && text.includes('.')) {
            const m = text.match(/[\w.+-]+@[\w.-]+/);
            if (m) href = 'mailto:' + m[0];
          } else if (/\+?\d[\d\s]{6,}/.test(text)) {
            const phone = text.replace(/[^\d]/g, '');
            if (phone.length >= 8) href = 'https://wa.me/' + phone;
          }
        }
        items.push(href ? { text, href } : { text });
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
  // RESOLUCIÓN DE RUTAS (funciona desde cualquier página del sitio)
  // ==========================================================================
  function getAbsoluteUrl(path) {
    try {
      const script = document.querySelector('script[src*="cv-pdf"]');
      if (script && script.src) {
        const scriptUrl = new URL(script.src, document.baseURI);
        const rootPath = scriptUrl.pathname.replace(/\/?js\/[^/]+$/, '/');
        return scriptUrl.origin + rootPath + path.replace(/^\.?\/+/, '');
      }
    } catch (e) {}
    try { return new URL(path, document.baseURI).href; }
    catch (e) { return path; }
  }

  // ==========================================================================
  // IMÁGENES → DATA URL
  // ==========================================================================
  function loadImageAsDataURL(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch (err) { reject(err); }
      };
      img.onerror = () => reject(new Error('No se pudo cargar: ' + src));
      img.src = src;
    });
  }

  async function makeCircularPhoto(src) {
    const dataURL = await loadImageAsDataURL(src);
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const size = 600;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        const borderW = Math.round(size * 0.025);
        const s = Math.min(img.naturalWidth, img.naturalHeight);

        // Recorte circular
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - borderW, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        const sx = (img.naturalWidth - s) / 2;
        const sy = (img.naturalHeight - s) / 2;
        ctx.drawImage(img, sx, sy, s, s, borderW, borderW, size - 2 * borderW, size - 2 * borderW);
        ctx.restore();

        // Borde azul
        ctx.strokeStyle = '#1e40af';
        ctx.lineWidth = borderW;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - borderW / 2, 0, Math.PI * 2);
        ctx.stroke();

        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataURL;
    });
  }

  // ==========================================================================
  // BUILDERS pdfmake
  // ==========================================================================
  function sectionTitleBlock(text) {
    return {
      stack: [
        { text, fontSize: 14, bold: true, color: '#1e3a8a' },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#f59e0b' }] }
      ],
      margin: [0, 14, 0, 8]
    };
  }

  function buildHeaderPdf(lang, photoDataURL, qrDataURL) {
    const isEs = lang === 'es';
    const dateStr = new Date().toLocaleDateString(
      isEs ? 'es-ES' : 'en-GB',
      { day: 'numeric', month: 'long', year: 'numeric' }
    );

    const columns = [];

    columns.push(photoDataURL
      ? { image: photoDataURL, fit: [90, 90], width: 90, alignment: 'center' }
      : { text: '', width: 90 });

    columns.push({
      stack: [
        { text: CONFIG.name, fontSize: 22, bold: true, color: '#1e3a8a', alignment: 'center' },
        { text: CONFIG.title, fontSize: 11, bold: true, color: '#1e40af', alignment: 'center', margin: [0, 2, 0, 0] },
        { text: CONFIG.cvLabel, fontSize: 9, color: '#64748b', alignment: 'center', margin: [0, 2, 0, 0] },
        { text: (isEs ? 'Actualizado: ' : 'Updated: ') + dateStr, fontSize: 8.5, color: '#64748b', alignment: 'center', margin: [0, 4, 0, 0] }
      ],
      width: '*',
      margin: [10, 22, 10, 0],
      alignment: 'center'
    });

    columns.push(qrDataURL
      ? { image: qrDataURL, fit: [80, 80], width: 80, alignment: 'center', margin: [0, 10, 0, 0] }
      : { text: '', width: 80 });

    return {
      stack: [
        { columns, columnGap: 10 },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#1e40af' }], margin: [0, 12, 0, 0] }
      ],
      margin: [0, 0, 0, 10]
    };
  }

  function buildProfilePdf(profile, lang) {
    if (!profile.length) return [];
    const isEs = lang === 'es';
    return [
      sectionTitleBlock(isEs ? 'Perfil profesional' : 'Professional profile'),
      { text: profile.join('\n\n'), fontSize: 9.5, alignment: 'justify', lineHeight: 1.4 }
    ];
  }

  function buildSidebarPdf(sidebar, lang) {
    if (!sidebar.length) return [];
    const isEs = lang === 'es';

    // Dividir en 2 columnas equilibradas
    const mid = Math.ceil(sidebar.length / 2);
    const left = sidebar.slice(0, mid);
    const right = sidebar.slice(mid);

    const buildColumn = (cards) => {
      const stack = [];
      cards.forEach(card => {
        stack.push({
          text: card.title,
          fontSize: 10,
          bold: true,
          color: '#1e40af',
          margin: [0, 6, 0, 3]
        });
        card.items.forEach(it => {
          if (it.href) {
            stack.push({
              text: '•  ' + it.text,
              link: it.href,
              color: '#1e40af',
              fontSize: 9,
              decoration: 'underline',
              margin: [6, 1, 0, 1]
            });
          } else {
            stack.push({
              text: '•  ' + it.text,
              fontSize: 9,
              margin: [6, 1, 0, 1]
            });
          }
        });
      });
      return { stack, width: '*' };
    };

    return [
      sectionTitleBlock(isEs ? 'Datos profesionales y personales' : 'Professional & personal details'),
      {
        columns: [buildColumn(left), buildColumn(right)],
        columnGap: 16
      }
    ];
  }

  // Sanea atributos href (decodifica &amp;, elimina backslashes, escapa espacios)
function sanitizeEntryHtml(html) {
  if (!html) return '';
  // 1) Limpiar hrefs malformados
  let out = html.replace(/href=(["'])(.*?)\1/gi, function (match, quote, url) {
    const u = url
      .replace(/&amp;/g, '&')
      .replace(/\\/g, '')
      .replace(/\s+/g, '%20')
      .trim();
    return 'href=' + quote + u + quote;
  });
  // 2) Eliminar cualquier tag que no sea strong/b/i/em/a/br
  out = out.replace(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>/gi, function (m, slash, name) {
    const n = name.toLowerCase();
    const keep = ['strong', 'b', 'i', 'em', 'a', 'br'];
    return keep.includes(n) ? m : '';
  });
  return out;
}

  // Conversor HTML → rich text de pdfmake, sin getComputedStyle (10–50x más rápido)
function fastHtmlToPdfmake(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const segments = [];

  function pushText(text, style) {
    if (!text) return;
    text = text.replace(/\s+/g, ' ');
    if (!text) return;
    const styleKey = style ? JSON.stringify(style) : '';
    const last = segments[segments.length - 1];
    const lastKey = last ? JSON.stringify(last._k || {}) : null;
    if (last && lastKey === styleKey) {
      last.text += text;
    } else {
      const node = { text };
      if (style && Object.keys(style).length) Object.assign(node, style);
      node._k = style || {};
      segments.push(node);
    }
  }

  function walk(node, inherited) {
    if (node.nodeType === 3) { pushText(node.nodeValue, inherited); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    const ns = { ...(inherited || {}) };
    if (tag === 'strong' || tag === 'b') ns.bold = true;
    if (tag === 'em' || tag === 'i') ns.italics = true;
    if (tag === 'br') { pushText(' ', inherited); return; }
    if (tag === 'a') {
      const href = node.getAttribute('href');
      if (href && href !== '#' && !href.startsWith('javascript:')) {
        ns.link = href;
        ns.color = '#1e40af';
        ns.decoration = 'underline';
      }
    }
    for (const child of node.childNodes) walk(child, ns);
  }

  walk(div, null);
  segments.forEach(s => delete s._k);

  if (segments.length === 0) return [];
  if (segments.length === 1) return [segments[0]];
  return [{ text: segments }];
}
   
   function buildSectionPdf(section, translatedEntries, lang) {
  const isEs = lang === 'es';
  if (!translatedEntries.length) return null;

  const out = [sectionTitleBlock(isEs ? section.titleEs : section.titleEn)];
  const tableBody = [];
  let currentGroup = null;
  let ok = 0, skipped = 0;
  const t0 = performance.now();

  for (const entry of translatedEntries) {
    if (entry.sectionGroup && entry.sectionGroup !== currentGroup) {
      currentGroup = entry.sectionGroup;
      tableBody.push([
        { text: '', border: [false, false, false, false] },
        {
          text: currentGroup,
          bold: true,
          color: '#1e40af',
          fontSize: 11,
          margin: [0, 8, 0, 4],
          border: [false, false, false, false]
        }
      ]);
    }

    let bodyContent;
    try {
      const cleanHtml = sanitizeEntryHtml(entry.dom.innerHTML);
      bodyContent = fastHtmlToPdfmake(cleanHtml);
    } catch (e) {
      console.warn('[cv-pdf] Conversión falló (' + (entry.year || '?') + '):', e.message);
      bodyContent = [];
    }

    if (!bodyContent || !bodyContent.length) {
      const plain = (entry.dom.textContent || '').replace(/\s+/g, ' ').trim();
      if (plain) bodyContent = [{ text: plain.substring(0, 2000) }];
      else { skipped++; continue; }
    }

    tableBody.push([
      {
        text: entry.year || '',
        bold: true,
        color: '#1e40af',
        fontSize: 9,
        border: [false, false, false, false],
        margin: [0, 3, 0, 3]
      },
      {
        text: bodyContent,
        fontSize: 9,
        border: [false, false, false, false],
        margin: [0, 3, 0, 3]
      }
    ]);
    ok++;
  }

  if (!tableBody.length) return null;

  out.push({
    table: {
      widths: [78, '*'],
      body: tableBody
    },
    layout: 'noBorders'
  });

  console.log('[cv-pdf] ' + section.key + ': ' + ok + ' ok, ' + skipped +
              ' omitidas · ' + Math.round(performance.now() - t0) + 'ms');
  return out;
}

  // ==========================================================================
  // GENERACIÓN DEL PDF
  // ==========================================================================

  async function generatePdf(lang, onProgress) {
  const isEs = lang === 'es';
  await loadPdfLibraries();

  // 1. Imágenes
  let photoDataURL = null, qrDataURL = null;
  try { photoDataURL = await makeCircularPhoto(getAbsoluteUrl(CONFIG.photo)); }
  catch (e) { console.warn('[cv-pdf] Foto no cargada:', e.message); }
  try { qrDataURL = await loadImageAsDataURL(getAbsoluteUrl(CONFIG.qr)); }
  catch (e) { console.warn('[cv-pdf] QR no cargado:', e.message); }

  // 2. Perfil + sidebar
  let profile, sidebar;
  if (document.querySelector('.about-text') && document.querySelector('aside .card')) {
    profile = extractProfileFromDoc(document, lang);
    sidebar = extractSidebarFromDoc(document, lang);
  } else {
    try {
      const idxDoc = await fetchIndexDoc();
      profile = extractProfileFromDoc(idxDoc, lang);
      sidebar = extractSidebarFromDoc(idxDoc, lang);
    } catch { profile = []; sidebar = []; }
  }

  // 3. Contenido
  const content = [];
  content.push(buildHeaderPdf(lang, photoDataURL, qrDataURL));
  content.push(...buildProfilePdf(profile, lang));
  content.push(...buildSidebarPdf(sidebar, lang));

  // 4. Secciones
  const totalSections = CONFIG.sections.length;
  for (let i = 0; i < totalSections; i++) {
    const s = CONFIG.sections[i];

    if (onProgress) onProgress({
      phase: 'fetch', current: i + 1, total: totalSections,
      label: (isEs ? s.titleEs : s.titleEn)
    });

    console.time('[cv-pdf] ' + s.key + ' fetch');
    let doc;
    try { doc = await fetchDoc(s.file); }
    catch (err) { console.warn('[cv-pdf] Error ' + s.file + ':', err.message); console.timeEnd('[cv-pdf] ' + s.key + ' fetch'); continue; }
    console.timeEnd('[cv-pdf] ' + s.key + ' fetch');

    const entries = parseEntries(doc);
    if (!entries.length) continue;

    console.time('[cv-pdf] ' + s.key + ' translate+build');
    const translatedEntries = [];
    for (let j = 0; j < entries.length; j++) {
      const entry = entries[j];
      const temp = document.createElement('div');
      temp.innerHTML = entry.html;
      if (isEs && s.translate) {
        try { await translateContainer(temp, lang, (d, t) => {
          if (onProgress) onProgress({ phase: 'translate', current: d, total: t });
        }); }
        catch (e) { console.warn('[cv-pdf] Error traduciendo ' + s.key + '/' + j + ':', e.message); }
      }
      translatedEntries.push({ year: entry.year, dom: temp, sectionGroup: entry.sectionGroup });
    }

    const sectionContent = buildSectionPdf(s, translatedEntries, lang);
    if (sectionContent) content.push(...sectionContent);
    console.timeEnd('[cv-pdf] ' + s.key + ' translate+build');
  }

  // 5. Documento
  const docDef = {
    pageSize: 'A4',
    pageMargins: [15, 20, 15, 22],
    content,
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1e293b' },
    footer: function (currentPage, pageCount) {
      return {
        columns: [
          { text: CONFIG.website, link: CONFIG.website, alignment: 'left', fontSize: 8, color: '#64748b' },
          { text: currentPage + ' / ' + pageCount, alignment: 'right', fontSize: 8, color: '#64748b' }
        ],
        margin: [15, 0, 15, 10]
      };
    }
  };

  console.log('[cv-pdf] Bloques en content:', content.length);
  
  // 6. Avisar al usuario que empieza la generación real
  if (onProgress) onProgress({ phase: 'building', label: isEs ? 'Generando PDF…' : 'Building PDF…' });

  const filename = `CV_Osmani_Tito-Corrioso_${lang.toUpperCase()}.pdf`;

  console.time('[cv-pdf] createPdf');
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.timeEnd('[cv-pdf] createPdf');
      reject(new Error(isEs
        ? 'La generación del PDF tardó más de 120 s. Reduce las secciones largas (papers/congress) o usa una conexión más rápida.'
        : 'PDF generation took more than 120s. Reduce long sections (papers/congress) or use a faster connection.'));
    }, 120000);

    try {
      window.pdfMake.createPdf(docDef).download(filename, () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        console.timeEnd('[cv-pdf] createPdf');
        console.log('[cv-pdf] ✓ PDF generado:', filename);
        resolve();
      });
    } catch (e) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      console.timeEnd('[cv-pdf] createPdf');
      reject(e);
    }
  });
}

  // ==========================================================================
  // ESTILOS (solo UI del menú, inyectados una sola vez)
  // ==========================================================================
  function injectStyles() {
    if (document.getElementById('cv-pdf-styles')) return;
    const style = document.createElement('style');
    style.id = 'cv-pdf-styles';
    style.textContent = `
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

      @media print {
        .cv-pdf-box { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  // ==========================================================================
  // UI: PANEL EN EL MENÚ
  // ==========================================================================
  function createUi() {
    const dropdown = document.querySelector('.nav-dropdown');
    if (!dropdown) return;
    if (document.getElementById('cv-pdf-li')) return;

    injectStyles();

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

    select.value = (document.documentElement.getAttribute('data-lang') === 'es') ? 'es' : 'en';

    function setStatus(text, isError) {
      statusEl.textContent = text || '';
      statusEl.classList.toggle('show', !!text);
      statusEl.classList.toggle('error', !!isError);
    }

    btn.addEventListener('click', async () => {
      if (isExporting) return;
      isExporting = true;
      btn.disabled = true;
      setStatus('');

      const lang = select.value === 'es' ? 'es' : 'en';
      const isEs = lang === 'es';

      const navDropdown = document.querySelector('.nav-dropdown');
      if (navDropdown) navDropdown.classList.remove('open');

      const onProgress = (info) => {
        if (info.phase === 'fetch') {
          setStatus((isEs ? 'Cargando ' : 'Loading ') + info.label + ' (' + info.current + '/' + info.total + ')');
        } else if (info.phase === 'translate') {
          const msg = (info.total > 0)
            ? (isEs ? 'Traduciendo… ' : 'Translating… ') + info.current + '/' + info.total
            : (isEs ? 'Traduciendo…' : 'Translating…');
          setStatus(msg);
        } else if (info.phase === 'building') {
  setStatus(isEs ? 'Generando PDF… (puede tardar hasta 30 s)' : 'Building PDF… (may take up to 30 s)');
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
