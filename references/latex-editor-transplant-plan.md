# LaTeX Equation Editor — transplant plan (old CE+ → current CE upstream)

Source: commit `620765fdf5c4046eeda0ae0bff00ac6f1ac36a76` ("Initial files") from the
old CE+ checkout `~/junk_eqn_editor/old`. Target: this repo, branch `equation_editor`
(davrot/overleaf-cep), CE upstream at `28ad3b03b7` (2026-06-26).

Status markers: [ ] todo · [x] done · [~] in progress

## 0. Requirements & constraints

- Port the `services/web/modules/latex-editor` module (WYSIWYG equation editor:
  MathLive math-field, command search, import selection, export wrapper, virtual
  keyboard, "Open in Equation Editor" from math preview tooltip).
- Update the UI to the **current Overleaf design system** (OLModal/OLButton/
  OLFormSelect/MaterialIcon, i18next keys, `ol-cm-toolbar-button` classes).
- **NO external CDN / runtime downloads (user instruction, 2026-08-27):** everything
  MathLive needs (JS, CSS, KaTeX fonts) is bundled into the Docker image at build
  time. Local `fontsDirectory` only.
- Hunt for bugs & improvements (phase C).
- Git: incremental commits at milestones, push to `origin` (davrot/overleaf-cep).
  Never create PRs. All communication/commits in English.
- "Done" = live-verified in the browser on the deployed server (testuser credentials
  in `~/junk_eqn_editor/testuser.txt`), not local tests.
- Ported code is suspect: full audit of every touched file (imports resolve, i18n,
  logic, scss aggregation, new API contracts).

## 1. Old commit — what is live vs dead (verified)

Live in old commit (the actual user path):
- `frontend/components/latex-editor-toolbar-button.tsx` — toolbar Σ button,
  listens for `latex-editor:open`, CM access via DOM hack (`.cm-content cmView`).
- `frontend/components/equation-editor-modal.tsx` — custom draggable modal:
  MathLive input | raw LaTeX toggle, search (513 commands), import selection,
  clear, virtual-keyboard toggle, export wrapper select, minimize (custom).
- `frontend/components/mathlive-input.tsx` — dynamic `import('mathlive')`,
  `fontsDirectory = '/fonts/mathlive/'`, textarea fallback.
- `frontend/data/latex-commands.mjs` — `latexCommands` (513 clean `{cmd,desc}`
  entries), `matrixTemplates` (7), `environmentTemplates` (10).
- `frontend/stylesheets/latex-editor.scss` — custom `latex-editor-*` classes.
- `index.mjs` — backend no-op module stub (logs on load).
- Wiring: `settings.defaults.js` (`sourceEditorToolbarEndButtons` +
  `moduleImportSequence`), `webpack.config.js` (mathlive fonts copy),
  `package.json` (mathlive ^0.105.0), `all.scss` (scss import),
  `math-preview-tooltip.tsx` (+35 lines: "Open in Equation Editor" menu item,
  **unconditional**).

Dead in old commit (nothing references it — NOT ported blindly, user rule):
- `components/symbol-palette.tsx` — orphaned.
- `components/templates-sidebar.tsx` — orphaned (imports matrix/environment
  templates).
- `data/index.mjs` + 15 category data files (~3.3 kLOC) — only used by the
  orphaned palette. → candidate for phase-C improvement (palette tab), not
  part of the base port.

Known old-code issues to fix during port:
1. CM access via DOM hack → use `useCodeMirrorViewContext()` (new contract).
2. Hardcoded English strings → i18next keys.
3. Custom z-index/draggable modal → OLModal (focus trap, escape, a11y).
4. MathLive loaded by dynamic import + separate fonts copy; CSS import unclear →
   unified local bundling (no CDN).
5. Tooltip menu item unconditional (dead UI when module disabled) → gate on
   feature `latex-editor`.
6. Minimize feature (custom drag window) dropped in favor of standard modal —
   deliberate UI-style change.

## 2. New-tree architecture (verified)

- Frontend entry: `frontend/js` feature-based layout; toolbar end buttons come
  from `Settings.overleafModuleImports.sourceEditorToolbarEndButtons` via the
  `importOverleafModules` babel macro (static imports baked into the IDE bundle).
  Still the right slot for our button (rendered inside CM React context →
  `useCodeMirrorViewContext()` works).
- Module frontend code convention (tsconfig include): `modules/<name>/frontend/js/**`.
  tsconfig includes `modules/**/frontend/js/**/*.*`.
- Module server stub: `modules/<name>/index.mjs`; loaded when name is in
  `moduleImportSequence` (Features hasFeature → ProjectController `project.features`
  meta → `useProjectContext().features` in frontend).
- `Features.hasFeature` THROWS on unknown feature names → must add a
  `case 'latex-editor'`.
- Design system: `OLModal/OLModalHeader/OLModalBody/OLModalFooter`, `OLButton`,
  `OLFormSelect` (react-bootstrap), `MaterialIcon` (ligature font — FILLED slice
  has no reliable list; UNFILLED slice list is authoritative:
  `frontend/fonts/material-symbols/unfilled-symbols.mjs` — contains `functions`).
  `ToolbarButton` core component renders icon without `unfilled` → build own
  `ol-cm-toolbar-button` (copy structure of end buttons like SwitchToPDFButton).
- i18n: `locales/en.json` (flat key map, alphabetical) + `useTranslation`.
- SCSS: `frontend/stylesheets/pages/all.scss` import list (module scss imported
  there, as old commit did).
- Webpack: CopyPlugin pattern (mathjax precedent) → `js/libs/mathlive-<ver>/`.
  CSS pipeline: sass → css-loader (url() rewriting → hashed assets in image) →
  MiniCssExtract. Babel: `@babel/react` automatic runtime (no `import React`).
- Tests: vitest `modules/*/test/unit/**/*.test.mjs` (Parallel project);
  `yarn test:unit`.
- Lint: `eslint --max-warnings 0` (flat config, `node:` prefix for builtins,
  repo-local binary).
- mathlive: latest 0.110.0 (old: ^0.105.0).

## 3. Plan

### Phase A — faithful port, new UI style
- [x] A1 module skeleton: `index.mjs`, `frontend/js/data/latex-commands.mjs`
  (513 commands + 7 matrix + 10 environment templates), pure logic split:
  `frontend/js/utils/equation-export.mjs` (wrapLatex), `frontend/js/utils/command-search.mjs`.
- [x] A2 unit tests `test/unit/src/equation-editor.test.mjs` (wrap, search,
  data integrity incl. no-crash-on-mixed-shapes, template shapes).
- [x] A3 `package.json` + `yarn install` (+ restore `yarn.lock` churn rule),
  `PackageVersions.js` mathlive pin, webpack CopyPlugin (css + fonts).
- [x] A4 settings: `sourceEditorToolbarEndButtons` → new component path;
  `moduleImportSequence` += `latex-editor`.
- [x] A5 Features.mjs `case 'latex-editor'` + ProjectController
  `latexEditorAvailable` feature meta.
- [x] A6 components (new style, i18n):
  - `latex-editor-toolbar-button.tsx` (OLButton + MaterialIcon `functions`
    unfilled; opens modal; listens `latex-editor:open`).
  - `equation-editor-modal.tsx` (OLModal; search; import; raw toggle;
    export wrapper OLFormSelect; Insert/Export primary).
  - `mathlive-input.tsx` (local CSS import, local fontsDirectory, textarea
    fallback kept).
- [x] A7 SCSS restyle (`latex-editor.scss` reworked to `ol-` design tokens) +
  `all.scss` import.
- [x] A8 i18n keys in `locales/en.json`.
- [x] A9 math-preview-tooltip: gated "Open in Equation Editor" item.
- [x] A10 lint clean (touched scopes), tsc (0 new errors), vitest green,
  parallel reviewer passes → commit + push.

### Phase B — build + live verification
- [x] B1 pre-rebuild review (diff analysis + log audit) → `make all`
      (server-ce of THIS checkout) → image revision == HEAD.
- [x] B2 cycle compose_cep overleafserver; container image == built image.
- [x] B3 startup log: module init line, no ERRORs.
- [x] B4 browser E2E (testuser.txt): toolbar button present; modal opens;
      MathLive renders (fonts local — network tab: no CDN); search works;
      insert at cursor works; import selection works; export wrappers correct;
      virtual keyboard toggles; tooltip menu item appears on math preview and
      opens editor with the equation; a11y (focus trap, Esc).
- [x] B5 fix live-found bugs (each with named root cause) → rebuild/loop as needed.

### Phase C — improvements (after core is live)
- [ ] C1 Symbol palette: port the 15 category data files + a new-style palette
      (categorized symbol grid) inside the modal; click-to-insert. (Revives old
      dead code as an actual feature — with unit tests for data integrity.)
- [ ] C2 Templates: matrix + environment template picker (from matrixTemplates /
      environmentTemplates) as a second modal section.
- [ ] C3 misc: keyboard shortcut / context-menu entries if cheap and clean;
      perf (lazy-load mathlive chunk only on first open — already achieved by
      dynamic import, verify chunk splitting).
- [ ] C4 final rebuild + live re-verification → commit + push.

## 4. Definition of done (from overleaf-agent-workflows skill)
1. Lint `--max-warnings 0` clean on touched scopes.
2. Unit tests green (vitest, own module).
3. Reviewer pass: no stray changes; dead-code exclusion confirmed.
4. `make all` exit 0 from this checkout's server-ce; image revision == HEAD.
5. Container cycled healthy; container image ID == built image ID.
6. Startup log shows module init, no ERRORs; feature works on live port.
7. Browser-verified E2E on deployed FQDN (psintern.neuro.uni-bremen.de).

## 5. Decisions log
- 2026-08-27: Icon = `functions` (unfilled variant, authoritative list) because
  filled slice has no verifiable icon list.
- 2026-08-27: Minimize/drag from old modal dropped — standard OLModal per new
  UI style. Restore/scroll handled by modal.
- 2026-08-27: No CDN — mathlive JS+CSS+fonts baked in image (user instruction).
- 2026-08-27: Old orphaned palette/templates-sidebar NOT blindly ported; palette
  returns as phase-C improvement with new-style implementation.
- 2026-08-27: i18n keys added to locales/en.json (new-tree convention; README
  "no hand edits" note is about translation vendor flow, not CE strings).

- 2026-08-27 (round 1): reverted OLModal migration — restored the old commit's
  NON-BLOCKING floating window (draggable, minimize/restore, no focus-trap) so
  the MathLive virtual keyboard (document.body) stays usable; keep the new-tree
  parts that strictly improve (i18n, CM-context import/insert, feature gate).
- 2026-08-27 (round 1): i18n runtime pipeline discovered — webpack
  translations-loader FILTERS locales/<lang>.json down to keys present in
  frontend/extracted-translations.json (regenerated by `yarn extract-translations`
  = i18next-scanner over t('literal') calls). Keys must exist in BOTH files;
  t(variable) lookups are not extracted — keep keys as literals.
- 2026-08-27 (round 2): custom events dispatched on document must set
  bubbles:true because shared useEventListener hooks bind WINDOW.
- 2026-08-27 (round 2): CopyPlugin toType:dir nests the glob structure under
  `to` — mathlive fonts landed in fonts/fonts/ while MFE.fontsDirectory pointed
  one level up (404 -> CDN fallback); copy to js/libs/mathlive-<version> so
  files land at <version>/fonts/. mathlive/static.css (incl. KaTeX font-face)
  must be imported from the module SCSS — it does NOT auto-ship.
- 2026-08-27 (round 3): coherent (body, environment) state — splitEquation()
  splits fence/environment into body + wrapper; modal default wrapper = inline;
  'Open in Equation Editor' dispatches the equation's doc range and the button
  selects it (visible mark), so Export replaces the original exactly; display
  math canonicalised to \[...\] (the display wrapper form). Accepted as the
  round-trip contract: import/open + Export = equation intact with environment.
