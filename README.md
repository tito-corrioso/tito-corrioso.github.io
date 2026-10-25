# Osmani Tito-Corrioso — Academic CV Website

Personal academic website and Curriculum Vitae for **Osmani Tito-Corrioso**, Ph.D. in Mathematical Sciences, researcher in post-quantum cryptography and cryptanalysis at the University of Matanzas, Cuba.

**Live site:** https://tito-corrioso.github.io/

---

## Features

- **Modern, responsive design** — clean layout that works on phones, tablets and desktops.
- **Dark mode** — automatic (follows system preference) with manual toggle and persistence in `localStorage`.
- **Full CV export to PDF** — professional multi-page PDF generated entirely in the browser with pdfmake, including profile, sidebar, all sections, signature and QR code. Available in English and Spanish (translated on the fly).
- **Per-paper citations** — one-click "Cite" button on every publication that offers the reference in APA 7th, Vancouver and BibTeX.
- **Bulk citation export** — download all publications at once as a single `.txt` (APA or Vancouver) or `.bib` (BibTeX) file.
- **Search and filter** on `papers.html` and `congress.html` — live text search plus filter by year, with sticky year group headers.
- **Reading progress bar** — subtle indicator at the top of long pages.
- **WhatsApp contact** — floating button and direct link in the sidebar.
- **Accessibility** — semantic HTML, `aria-current`, skip-to-content link, `prefers-reduced-motion` support, keyboard-friendly modals.
- **SEO** — `sitemap.xml`, `robots.txt`, JSON-LD `Person` schema, custom `404.html`, Open Graph and Twitter Card metadata.
- **Print styles** — a clean, ink-friendly print layout via `@media print`.

---

## Tech stack

- **HTML5** + **CSS3** (custom properties, grid, flexbox, clamp).
- **Vanilla JavaScript** — no frameworks, no build step.
- **pdfmake** — client-side PDF generation.
- **MyMemory Translation API** — optional on-the-fly translation of the CV when exporting to Spanish.
- **Google Fonts** — Inter and Playfair Display.
- **GitHub Pages** — hosting and HTTPS.

No backend, no database, no bundler. Everything runs in the browser.

---

## Project structure

    .
    ├── index.html            # Homepage (About + sidebar)
    ├── papers.html           # Scientific publications
    ├── congress.html         # Conference contributions
    ├── projects.html         # Research projects
    ├── courses.html          # Postgraduate courses taught / received
    ├── education.html        # Academic background
    ├── thesis.html           # Authored and supervised theses
    ├── work.html             # Professional experience
    ├── awards.html           # Awards and acknowledgments
    ├── coauthors.html        # Collaborators
    ├── 404.html              # Custom not-found page
    ├── sitemap.xml
    ├── robots.txt
    ├── README.md
    ├── css/
    │   └── style.css         # Single stylesheet (tokens, layout, print)
    ├── js/
    │   ├── main.js           # Dropdown, scroll reveal, back to top
    │   ├── whatsapp.js       # Floating WhatsApp button and contact link
    │   ├── cv-pdf.js         # Full CV export to PDF
    │   └── enhance.js        # Progressive enhancements (dark mode, citations,
    │                         #   search, reading progress, share, badges...)
    └── img/
        ├── otc.jpg
        ├── favico.png
        ├── favicon-*.png
        ├── apple-touch-icon.png
        ├── android-chrome-192x192.png
        ├── site.webmanifest
        ├── QR.jpg
        └── Firma_OTC_4mm.png

---

## Local development

The site is fully static, but some features (like fetching `papers.html` to build the PDF) require serving it over HTTP — opening `index.html` directly from the filesystem (`file://`) will not work.

    # Python 3
    python3 -m http.server 8000

    # or Node.js
    npx serve .

Then open http://localhost:8000.

---

## How to add content

### Add a new paper

Open `papers.html` and copy any existing block, then update it:

    <article class="entry reveal">
      <div class="entry-year">22 · 2026</div>
      <div class="entry-body">
        Author, A.; <strong>Tito-Corrioso, O.</strong> (2026).
        <em>Title of the paper</em>.
        <strong>Journal Name, vol(issue): pages.</strong>
        ISSN: XXXX-XXXX.
        <br><a href="https://doi.org/10.xxxx/xxxxx">Download PDF</a>
      </div>
    </article>

The "Cite" button and the bulk export will pick it up automatically. If the automatic parser fails (unusual author formatting, missing DOI...), you can override the citation manually with `data-*` attributes on the `<article>`:

    <article class="entry reveal"
             data-doi="10.3390/cryptography8040045"
             data-apa="Full APA 7th citation text"
             data-vancouver="Full Vancouver citation text"
             data-bibtex="@article{key, author = {...}, ...}">
      ...
    </article>

### Add a new congress, project, course, thesis, award or coauthor

The structure is identical: copy an existing `.entry` block in the corresponding page and update its content.

### Add a new page

1. Copy an existing page (for example `projects.html`).
2. Update the `<title>`, the `.page-header` title and the content.
3. Add a new `<li>` to the `.nav-dropdown` menu in all pages (currently ten HTML files).
4. Add the new URL to `sitemap.xml`.
5. If it should appear in the PDF export, add a new entry to the `CONFIG.sections` array in `js/cv-pdf.js`.

---

## PDF export

The full CV can be exported at any time:

- From the **Download CV (PDF)** button in the homepage hero.
- From the **Export CV** panel inside the navigation dropdown (available on every page).

Both options produce the same result. The PDF is generated entirely in the browser with pdfmake and includes:

- Cover with photo, name, title, date and QR code.
- Professional profile and personal details.
- Education, work experience, projects, courses, theses, awards, congress and papers.
- Signature at the end.
- Running header and page numbers on pages 2 and beyond.

The export language (English or Spanish) is selected in the dropdown panel. Spanish translation is performed on the fly; if the translation service is unavailable, the original English text is kept.

---

## Customization

### Colors, fonts and spacing

All design tokens live in `:root` inside `css/style.css`:

    :root {
      --primary: #1e40af;
      --accent: #f59e0b;
      --font-serif: 'Playfair Display', Georgia, serif;
      /* ... */
    }

Change them there once and the whole site (and dark mode) follows.

### Enable or disable individual enhancements

Open `js/enhance.js` and edit the `FEATURES` object:

    const FEATURES = {
      darkMode:             true,
      readingProgress:      true,
      heroDownload:         true,
      citations:            true,
      share:                true,
      paperSearch:          true,
      stickyYears:          true,
      scrollSpy:            true,
      toasts:               true,
      academicBadges:       true,
      citationBulkDownload: true
    };

Set any of them to `false` to disable that feature. If a feature fails at runtime, the others keep working — every module is wrapped in `try/catch`.

---

## Language

- **Site content:** English (primary).
- **CV PDF:** English or Spanish, selectable at export time.

Spanish versions of individual sections are wrapped in `<span lang="es">` elements. They are currently hidden by CSS but the markup is kept for future expansion and used by the PDF translator.

---

## Deployment

The site is deployed automatically on **GitHub Pages** from the `main` branch.

Every `git push` to `main` republishes the site at https://tito-corrioso.github.io/ within a minute.

To deploy your own fork:

1. Fork the repository.
2. Go to **Settings → Pages**.
3. Set **Source** to *Deploy from a branch* → `main` / `(root)`.
4. (Optional) add a custom domain and enable HTTPS.

---

## Privacy

- No cookies are set by the site itself.
- The only third-party scripts are the visit counter and (optionally) Google Fonts.
- The PDF export runs locally; no CV data leaves the browser except the text sent to the MyMemory translation API when the Spanish PDF is requested.

---

## License

- **Content** (text, CV data, publications): © Osmani Tito-Corrioso. All rights reserved.
- **Code** (HTML, CSS, JavaScript): MIT License. Feel free to fork and adapt.

---

## Acknowledgments

- Design, code and CV structure: Osmani Tito-Corrioso.
- PDF generation: pdfmake (http://pdfmake.org/).
- Typography: Google Fonts (https://fonts.google.com/).
