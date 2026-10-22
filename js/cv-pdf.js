/* ============================================================================
   CV-PDF.JS — Exportación profesional del CV a PDF
   Requiere: html2pdf.bundle.min.js (cargado desde CDN en el HTML)
   ============================================================================ */

(function () {
  'use strict';

  // ==========================================================================
  // 1. CONFIGURACIÓN
  // ==========================================================================
  const CV_CONFIG = {
    name: 'Osmani Tito-Corrioso',
    title: 'PhD. in Mathematical Science',
    cvLabel: 'Curriculum Vitae',
    lastUpdate: new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    }),
    photo: 'img/otc.jpg',
    qr: 'img/QR.jpg',
    website: 'https://osmanitito.github.io/' // opcional, solo informativo
  };

  // ==========================================================================
  // 2. CARGA DINÁMICA DE html2pdf (si no está ya en la página)
  // ==========================================================================
  function loadHtml2Pdf() {
    return new Promise((resolve, reject) => {
      if (window.html2pdf) return resolve(window.html2pdf);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = () => resolve(window.html2pdf);
      s.onerror = () => reject(new Error('No se pudo cargar html2pdf.js'));
      document.head.appendChild(s);
    });
  }

  // ==========================================================================
  // 3. TRADUCCIÓN (MyMemory API — gratuita, sin clave)
  // ==========================================================================
  async function translateText(text, targetLang) {
    if (!text || targetLang === 'en') return text;
    const url = 'https://api.mymemory.translated.net/get?' +
      'q=' + encodeURIComponent(text.slice(0, 500)) +
      '&langpair=en|' + targetLang;
    try {
      const r = await fetch(url);
      const j = await r.json();
      return (j.responseData && j.responseData.translatedText) || text;
    } catch {
      return text; // si falla, se queda en inglés
    }
  }

  // Traduce un array de strings en paralelo (con límite sencillo)
  async function translateBatch(items, targetLang) {
    if (targetLang === 'en') return items;
    return Promise.all(items.map(t => translateText(t, targetLang)));
  }

  // ==========================================================================
  // 4. EXTRACCIÓN DE DATOS DE LA PÁGINA ACTUAL
  // ==========================================================================
  function getText(selector) {
    const el = document.querySelector(selector);
    return el ? el.textContent.trim() : '';
  }

  function collectAbout() {
    const ps = document.querySelectorAll('.about-text p[lang="en"]');
    return Array.from(ps).map(p => p.textContent.trim());
  }

  function collectSidebar() {
    const cards = {};
    document.querySelectorAll('aside .card').forEach(card => {
      const title = card.querySelector('.card-title');
      if (!title) return;
      const key = title.textContent.trim().split('\n')[0].toLowerCase();
      const items = Array.from(card.querySelectorAll('li')).map(li => li.textContent.trim());
      cards[key] = items;
    });
    return cards;
  }

  // ==========================================================================
  // 5. CONSTRUCCIÓN DEL HTML DEL CV (para el PDF)
  // ==========================================================================
  async function buildCvHtml(lang) {
    const isEs = lang === 'es';

    // --- Datos base (textos que sí se traducen) ---
    const aboutEn = collectAbout();
    const about = isEs ? await translateBatch(aboutEn, 'es') : aboutEn;

    const sidebar = collectSidebar();

    // --- Cabecera ---
    const header = `
      <header class="cv-header">
        <div class="cv-header-left">
          <img src="${CV_CONFIG.photo}" alt="Photo" class="cv-photo">
        </div>
        <div class="cv-header-center">
          <h1 class="cv-name">${CV_CONFIG.name}</h1>
          <p class="cv-title">${CV_CONFIG.title}</p>
          <p class="cv-label">${CV_CONFIG.cvLabel}</p>
          <p class="cv-date">${isEs ? 'Actualizado' : 'Updated'}: ${CV_CONFIG.lastUpdate}</p>
        </div>
        <div class="cv-header-right">
          <img src="${CV_CONFIG.qr}" alt="QR" class="cv-qr">
        </div>
      </header>
    `;

    // --- Perfil ---
    const profile = `
      <section class="cv-section">
        <h2 class="cv-section-title">${isEs ? 'Perfil profesional' : 'Professional profile'}</h2>
        ${about.map(p => `<p>${p}</p>`).join('')}
      </section>
    `;

    // --- Datos personales / profesionales (extraídos del sidebar) ---
    // Nota: los títulos de las tarjetas se traducen; el contenido se deja tal cual
    //       (son datos objetivos: fechas, titulaciones, enlaces).
    let personalHtml = '<section class="cv-section"><h2 class="cv-section-title">' +
      (isEs ? 'Datos profesionales y personales' : 'Professional & personal details') +
      '</h2><div class="cv-two-col">';

    Object.keys(sidebar).forEach(key => {
      // Saltamos tarjetas que no aportan al CV en PDF
      if (key.includes('web') || key.includes('erd') || key.includes('visit')) return;
      personalHtml += `<div class="cv-col"><h3>${key}</h3><ul>`;
      sidebar[key].forEach(item => {
        personalHtml += `<li>${item}</li>`;
      });
      personalHtml += '</ul></div>';
    });
    personalHtml += '</div></section>';

    // --- Secciones con entradas (fecha + contenido) ---
    // En el PDF solo incluimos las secciones más relevantes; el resto se puede
    // añadir fácilmente siguiendo el mismo patrón.

    // Función auxiliar para extraer entradas de una página (si existe)
    // Como el PDF se genera desde index.html, las secciones de papers/congress
    // no están en el DOM. Las incluimos manualmente resumidas o dejamos enlaces.
    // Para mantener el PDF completo, se recomienda generar desde una página
    // que contenga todo, o usar los datos del sidebar + about.

    // --- Cierre ---
    return `
      <div class="cv-root">
        ${header}
        ${profile}
        ${personalHtml}
        <footer class="cv-footer">
          <p>${CV_CONFIG.website}</p>
        </footer>
      </div>
    `;
  }

  // ==========================================================================
  // 6. INYECCIÓN DE ESTILOS ESPECÍFICOS PARA EL PDF
  // ==========================================================================
  function injectPdfStyles() {
    if (document.getElementById('cv-pdf-styles')) return;
    const style = document.createElement('style');
    style.id = 'cv-pdf-styles';
    style.textContent = `
      .cv-root {
        font-family: 'Inter', Arial, Helvetica, sans-serif;
        font-size: 10pt;
        color: #1e293b;
        line-height: 1.5;
        background: #fff;
        padding: 0;
      }

      /* --- Cabecera de 3 columnas --- */
      .cv-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding-bottom: 1rem;
        border-bottom: 3px solid #1e40af;
        margin-bottom: 1.5rem;
      }
      .cv-header-left { flex: 0 0 auto; }
      .cv-header-center { flex: 1 1 auto; text-align: center; }
      .cv-header-right { flex: 0 0 auto; }

      .cv-photo {
        width: 110px;
        height: 110px;
        object-fit: cover;
        border-radius: 50%;
        border: 3px solid #1e40af;
      }
      .cv-qr {
        width: 80px;
        height: 80px;
        object-fit: contain;
      }

      .cv-name {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 22pt;
        color: #1e3a8a;
        margin: 0 0 .15rem;
      }
      .cv-title {
        font-size: 11pt;
        color: #1e40af;
        margin: 0;
        font-weight: 600;
      }
      .cv-label {
        font-size: 10pt;
        color: #64748b;
        margin: .15rem 0;
        letter-spacing: .05em;
        text-transform: uppercase;
      }
      .cv-date {
        font-size: 9pt;
        color: #64748b;
        margin: 0;
      }

      /* --- Secciones --- */
      .cv-section { margin-bottom: 1.5rem; }
      .cv-section-title {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 14pt;
        color: #1e3a8a;
        border-bottom: 2px solid #f59e0b;
        padding-bottom: .25rem;
        margin-bottom: .75rem;
      }
      .cv-section p { margin: 0 0 .6rem; text-align: justify; }

      /* --- Dos columnas para datos personales --- */
      .cv-two-col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .cv-col h3 {
        font-size: 11pt;
        color: #1e40af;
        margin: 0 0 .4rem;
        font-weight: 700;
      }
      .cv-col ul { list-style: disc; padding-left: 1.2rem; }
      .cv-col li { margin-bottom: .2rem; font-size: 9.5pt; }

      /* --- Pie --- */
      .cv-footer {
        margin-top: 2rem;
        padding-top: .75rem;
        border-top: 1px solid #cbd5e1;
        text-align: center;
        font-size: 8.5pt;
        color: #64748b;
      }

      /* --- Forzar que el PDF no parta elementos --- */
      .cv-section, .cv-header { break-inside: avoid; page-break-inside: avoid; }
    `;
    document.head.appendChild(style);
  }

  // ==========================================================================
  // 7. GENERACIÓN Y DESCARGA DEL PDF
  // ==========================================================================
  async function generatePdf(lang) {
    // 1. Cargar librería
    await loadHtml2Pdf();

    // 2. Inyectar estilos
    injectPdfStyles();

    // 3. Construir HTML
    const html = await buildCvHtml(lang);

    // 4. Crear contenedor temporal (oculto en la página, pero renderizable)
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm'; // ancho A4 aproximado
    container.style.background = '#fff';
    container.innerHTML = html;
    document.body.appendChild(container);

    // 5. Opciones de html2pdf
    const opt = {
      margin: [10, 12, 12, 12], // mm
      filename: `CV_Osmani_Tito-Corrioso_${lang.toUpperCase()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        compress: true
      },
      pagebreak: {
        mode: ['avoid-all', 'css'],
        avoid: ['.cv-section', '.cv-header']
      }
    };

    // 6. Generar PDF
    try {
      await html2pdf().set(opt).from(container).save();
    } finally {
      // 7. Limpiar
      document.body.removeChild(container);
    }
  }

  // ==========================================================================
  // 8. UI: BOTÓN EN EL MENÚ + SELECTOR DE IDIOMA
  // ==========================================================================
  function createPdfButton() {
    const dropdown = document.querySelector('.nav-dropdown');
    if (!dropdown) return;

    // Evitar duplicados
    if (document.getElementById('cv-pdf-li')) return;

    const li = document.createElement('li');
    li.id = 'cv-pdf-li';
    li.style.cssText = 'border-top:1px solid var(--border,#e2e8f0);margin-top:.35rem;padding-top:.35rem;';

    li.innerHTML = `
      <a href="#" id="cv-pdf-trigger"
         style="display:flex;align-items:center;gap:.6rem;padding:.6rem .9rem;
                border-radius:8px;color:var(--text,#1e293b);
                font-weight:600;font-size:.95rem;text-decoration:none;
                transition:background .2s ease;">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"
             style="flex-shrink:0;color:#ef4444;">
          <path d="M7 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5H7Zm7 1.5L18.5 9H14V4.5ZM8 13h8v1.5H8V13Zm0 3h8v1.5H8V16Z"/>
        </svg>
        <span>
          <span lang="en">Download CV (PDF)</span>
          <span lang="es">Descargar CV (PDF)</span>
        </span>
      </a>
    `;

    li.querySelector('#cv-pdf-trigger').addEventListener('click', async (e) => {
      e.preventDefault();

      // Cerrar el menú desplegable
      const navDropdown = document.querySelector('.nav-dropdown');
      if (navDropdown) navDropdown.classList.remove('open');

      // Preguntar idioma (solo si el usuario quiere traducir)
      const wantEs = window.confirm(
        '¿Desea exportar el CV también en español?\\n\\n' +
        'Aceptar = Español (se traducirán los textos, excepto publicaciones y congresos)\\n' +
        'Cancelar = English'
      );

      const lang = wantEs ? 'es' : 'en';

      // Feedback visual
      li.querySelector('a').style.opacity = '.6';
      li.querySelector('a').style.pointerEvents = 'none';

      try {
        await generatePdf(lang);
      } catch (err) {
        console.error(err);
        alert('No se pudo generar el PDF. Revisa la consola para más detalles.');
      } finally {
        li.querySelector('a').style.opacity = '';
        li.querySelector('a').style.pointerEvents = '';
      }
    });

    dropdown.appendChild(li);
  }

  // ==========================================================================
  // 9. INICIALIZACIÓN
  // ==========================================================================
  function init() {
    createPdfButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();