# SVG Diagram Editor (`modules/diagram`)

A built-in, offline drawing editor for **SVG documents** in Overleaf CE,
based on the full **SVG-Edit 7.4.2** application.

Create a figure for `\includegraphics`:

1. **New file → Diagram (SVG)** (or open any `*.svg`).
2. Open the file — the editor boots in **Visual** mode (the full SVG-Edit
   UI: toolbars, rulers, layer panel, zoom, text, groups, gradients,
   context menus, …). Switch to **Code** at the top of the editor to edit
   the raw SVG source.
3. **Save** — the editor keeps the **SVG source** in the document
   (editable, diffable, versioned) and re-creates the companions:
   - **`name.png`** (bitmap raster, 2× the diagram size),
   - **`name.pdf`** (VECTOR PDF, browser-side `svg2pdf.js` + `jsPDF`), with
     **page size exactly equal to the diagram's own size** (1 SVG user
     unit = 1 pt — SVG-Edit's coordinate space is points, its standard A4
     canvas is 842×595 — zero offset) so `\includegraphics{diagram}` renders
     at the diagram's natural size — no A4 letterboxing/rescaling (A4 +
     margin-fit only as fallback for SVGs without usable dimensions).
     The PNG serves as bitmap fallback.

Everything ships inside our own image and works fully offline — no CDN,
no telemetry, no external origin.

## Implementation

The full `svgedit` 7.4.2 app (npm `dist/editor/` build) is **vendored as a
static subtree** at `services/web/public/static/svgedit/` and served by
Overleaf at `/static/svgedit/`:

- `Editor.js` — the app bundle (self-contained ESM, no imports at runtime
  except the extensions below),
- `svgedit.css` — app layout/theme,
- `images/`, `components/` — icons and picker assets,
- `extensions/` — the built-in extensions (shapes, polystar, panning,
  markers, grid, eyedropper, connector, opensave, layer view),
- `extensions/_virtual/_vite/preload-helper.js` and
  `extensions/node_modules/browser-fs-access/` — shared bundle
  dependencies of the extension modules (every `ext-*.js` statically
  imports the preload helper; `ext-opensave` imports browser-fs-access).
  **If you re-vendor the SVG-Edit dist, keep these paths** — without them
  all extension toolbars silently fail to load (each extension import 404s
  and only a console error is logged, so the editor still boots),
- `LICENSE` — see **License** below.

It runs in a **same-origin iframe** (`embed.html` + `embed.js`) and
talks to the React component through a tiny bridge
(`window.__olSvgEmbed`):

```
parent (Overleaf)                    frame (SVG-Edit app)
    │  iframe src=/static/svgedit/embed.html
    │  waits for window.__olSvgEmbed (poll)
    │─── .load(document SVG text) ────────────────────────▶
    │◀── .onChanged(svg)  (debounced canvas content) ───────
    │  → writes SVG into the CodeMirror-backed document
    │    (Overleaf's sync/version history picks it up)
    │── Save button: companion .png + vector .pdf export ──▶ (parent-side,
    │    from the current SVG text via svg2pdf.js + jsPDF)
```

Why an iframe (rather than mounting the app inline):

- the app resolves `imgPath`/`extPath` **relative to the document base
  URL** and loads extensions with runtime dynamic `import()` — a static
  subtree under `/static/svgedit/` makes both resolve correctly;
- its document-level `keydown` handlers, cookie usage, focus handling and
  CSS stay in the frame; Overleaf's focus-trap, shortcuts and global
  styles are untouched;
- same-origin means the bridge is a direct property call (no postMessage
  ceremony) and the parent can read/verify the frame any time it wants.

Host hardening in `embed.js`:

- **`ext-storage` is excluded** from the extension list (it is the source
  of the storage prompt, the `svgeditstore` cookie, cached auto-load and
  the `beforeunload` auto-save); `noStorageOnLoad` is set as a second
  layer, and `?storagePrompt=false` is in the URL as a third,
- **disk-backed file ops are pruned post-boot** (embed.js
  `pruneDangerousFileOps`): New/Open/Save/Save as from the opensave menu
  are removed — the parent owns the document, so a cleared canvas or a
  loaded local file would sync into (or overwrite) the project source, and
  a File-System-Access “save” would masquerade as a project save. Import
  (data-URI / inline-SVG embed) and drop-to-import are kept. The removed
  menu items’ shortcut keys (bare N/S) keep firing through document-level
  listeners that survive detachment, so a capture-phase keydown blocker
  replaces them (bare N or S with target = BODY is swallowed). A
  MutationObserver on the editor menu re-prunes if ext-opensave attaches
  its items late.
- **the Image tool (core) is replaced with a local-file-dialog tool**
  (embed.js `wireImageToolToFileDialog`; user decision, option a):
  click → native file dialog → the chosen file is embedded right on the
  canvas (SVG inline, raster as data URI — same pipeline as Import and
  drag-and-drop). The stock tool asked for a typed URL/path instead, which
  produces `\u003cimage href=\u003e` references that break inside an
  Overleaf-owned document. A project-file-tree picker (option b) remains a
  possible future addition (would fetch the project file and inline it;
  note that relative `href`s inside the canvas resolve against the embed
  origin, not the project, hence inlining).
- **left-bar tail order is normalised** to the reference layout
  (`normaliseLeftBarOrder` + observer): the extension inits resolve
  asynchronously and insert by fixed index/append, so the tail
  (…text, shapelib, image, polygon, connect, eyedropper) is a race; the
  guard re-applies the order after any late insertion and is a no-op once
  stable. The full toolbar (14 buttons, exact order) was verified against
  the live reference (svgedit.netlify.app).
- **branding is neutralised** post-boot: the external home-page menu item
  is removed, the main-menu label/logo are replaced with “Diagram”, and
  the canvas library's `<!-- Created with … -->` comment is stripped from
  every serialised string before it can reach the document
  (see `stripBrandingComments` in `diagram-model.ts`),
- `no_save_warning` disables the browser "unsaved changes" prompt —
  Overleaf owns the save lifecycle,
- the parent **always** owns the project content: the frame can only
  receive SVG text and report its canvas state, it never talks to our
  API and never uploads anything.

The `visualEditorProviders` registration makes the canvas the default view
for `.svg` documents (the Code/Visual toggle remembers the user's choice
per family); a one-line default in `editor-properties-context.tsx`
(`showVisualForFile`) makes provider-claimed files open in Visual mode
when no explicit preference is stored yet.

## Files

- `services/web/public/static/svgedit/` — vendored SVG-Edit 7.4.2 app
  (Editor.js, CSS, icons, extensions, `LICENSE`) plus the host entry
  (`embed.html`, `embed.css`, `embed.js` bridge + config + rebrand).
- `frontend/js/components/diagram-editor.tsx` — the editor shell: iframe,
  bridge wiring, document syncing, companion save/export status.
- `frontend/js/components/diagram-editor.css` — shell styles.
- `frontend/js/components/create-diagram-file.tsx` — “New file →
  Diagram (SVG)” entry (`createFileModes` hook).
- `frontend/js/visual-editor-provider.js` — `visualEditorProviders` hook
  (claims `.svg`, provides this component, default-family storage seeding).
- `frontend/js/util/diagram-model.ts` — SVG document helpers
  (blank document, import normalisation, branding-comment stripping,
  dimension probing; Node-testable).
- `frontend/js/util/diagram-utils.ts` — companion naming + file-tree
  helpers (Node-testable).
- `frontend/js/util/diagram-export.ts` — browser-side SVG → PNG (canvas)
  and SVG → vector PDF (`svg2pdf.js` + `jsPDF`) pipeline.
- `test/unit/` — Node-testable helpers via vitest.
- `index.mjs` — module marker (no server configuration needed).
- `services/web/config/settings.defaults.js` — wiring:
  `overleafModuleImports.visualEditorProviders` → this provider,
  `createFileModes` → the create-file pane, `moduleImportSequence`
  includes `diagram`, `.svg` is a text extension.

## License

SVG-Edit 7.4.2 ships under a permissive OR-licensing choice
(`(MIT AND Apache-2.0 AND ISC AND LGPL-3.0-or-later AND X11)`,
`svgedit@7.4.2` on npm). We take the **MIT** grant: the full text is
vendored at `services/web/public/static/svgedit/LICENSE`
(`LICENSE-MIT.txt` from the package) and the version/provenance is this
README. The vendored tree is unmodified except for the added `embed.*`
host files and the removal of source maps/tests. Two official-dist
dependency files that were dropped during the original copy were
restored byte-identical from the official 7.4.2 dist
(svgedit.netlify.app): `extensions/_virtual/_vite/preload-helper.js`
(Vite, MIT) and `extensions/node_modules/browser-fs-access/dist/
index.modern.js` (browser-fs-access, Apache-2.0 — one of SVG-Edit's own
OR-license options). Both are required for the extension modules to
load at all.

## Notes & limitations

- The document is plain SVG text; the app is a superset of that format —
  round-trips are stable (the app loads and serialises SVG), but advanced
  features (filters, complex gradients) may be normalised by it.
- Companion renders are computed in the browser on Save; the first Save
  after switching back and forth takes a moment for large figures.
- If the browser cannot start the app (e.g. no ES modules), the editor
  degrades to the raw SVG source view plus a hint in the footer.
