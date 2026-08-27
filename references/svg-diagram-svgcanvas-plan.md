# Work plan: TUI image editor fix + diagram editor → @svgedit/svgcanvas

Status: IN PROGRESS (started right after user request to switch to svgcanvas)

## 1. TUI image editor (modules/toast-image) — ROOT CAUSE PROVEN (evidence below)

Deployed failing image: `sharelatex:transplant-image-plugins` = build of commit `a9eab95874`
(image tag `<base>-a9eab95874f07b...` created 43 min before report).

Browser console (user): `TypeError: n is not a constructor` at `new t ... new t ... t.value ...`
during `new ImageEditorCtor(mount, options)`.

Evidence (node_modules/tui-image-editor@3.15.3, dist/tui-image-editor.js):
- L47415 `SUB_UI_COMPONENT = { Shape, Crop, Resize, Flip, Rotate, Text, Mask, Icon, Draw, Filter }` — NO Guide.
- L47683 `_makeSubMenu()`: `forEach(this.options.menu, (menuName) => { const SubComponentClass = SUB_UI_COMPONENT[cap(menuName)]; ... _this[menuName] = new SubComponentClass(...) })`
  → current code's `menu: [...,'guide']` makes this `new undefined` ⇒ "n is not a constructor" thrown inside the UI constructor ⇒ matches the user's stack exactly.
- L49744/60003/60031: ImageEditor public API = `loadImageFromFile(file,name)` / `loadImageFromURL(url,name)` (Promise). **No** `loadImage(options)` method exists.
  → current code's post-constructor `await editor.loadImage({...})` would throw `not a function` next (second latent bug in same function).
- L48222 `initCanvas()`: `loadImageInfo = this._getLoadImage(); if (loadImageInfo.path) this._actions.main.initLoadImage(...).then(...activeMenuEvent())`
  → only the `includeUI.loadImage` path activates menus (`activeMenuEvent` L48160). So the old working plugin's pattern (includeUI.loadImage, no explicit call) is the ONLY menu-activating pattern.
- L49947 `initLoadImage` action = `loadImageFromURL(p,n).then(sizeValue => { exitCropOnAction(); ui.initializeImgUrl = imagePath; ui.resizeEditor(...); clearUndoStack(); invoker.fire(EXECUTE_COMMAND,'Load') })`
  → `ui.initializeImgUrl` set + `executeCommand`('Load') fired = load complete signals.
- L45766 ImageEditor ctor: `this._invoker.on(EXECUTE_COMMAND, (command) => this.ui.fire(EXECUTE_COMMAND, command))` ⇒ listener attaches on `editor.ui`, not `editor`.
- L42681/42757 default `common.bi.image` = `https://uiccdn.toast.com/...` ⇒ theme overrides with `'common.bi.image':''` required (zero-CDN requirement).
- L48406 `CustomEvents.mixin(Ui)` ⇒ `ui.on/off/fire` exist.
- historyNames.LOAD_IMAGE = 'Load' (L41109) — the command name for the initial load.

OLD WORKING PLUGIN (`.plugin-src/.../toast-image-editor.tsx`, user-verified working pre-transplant):
- includeUI.loadImage {path,name} + theme{common.bi.image:'',...} + menu ['crop','flip','rotate','draw','shape','icon','text','mask','filter'] + initMenu 'filter' + uiSize 100%/100% + menuBarPosition 'left' + loadButton:false + downloadButton:false + cssMaxWidth:1200/cssMaxHeight:800 + usageStatistics:false
- NO explicit `editor.loadImage(...)` call (grep: 'loadImage' appears exactly once — the option).

### Fix (applied to services/web/modules/toast-image/frontend/js/components/toast-image-editor.tsx)
1. Menu → old working list (all valid SUB_UI_COMPONENT keys).
2. Remove the non-existent `editor.loadImage(...)` call; keep `includeUI.loadImage` (required: menu activation).
3. initMenu 'filter', menuBarPosition 'left' (old working values).
4. `ready` gate = image actually loaded: poll `editor.ui?.initializeImgUrl` (bounded, 20s) + `ui.on('executeCommand', name==='Load')` (both deterministic; data-safety: Save stays disabled until real image on canvas).
5. Dirty tracking: `ui.on('executeCommand', name!==undefined && name!=='Load')` + `ui.on('afterUndo')`/`('afterRedo')` ⇒ dirtyRef (replaces inert `editor.on('image:updated')`).
6. Retry path: destroy previous instance + `container.replaceChildren()` before re-mount (previously: second mount div appended to same container ⇒ two TUI instances).
7. Type: drop `loadImage` member (nonexistent API), add `ui`.

## 2. Diagram editor (modules/drawio) → @svgedit/svgcanvas (user decision, this session)

Why: maxGraph route required porting the 44k-line mxgraph grapheditor example (master only ships drawio-grade files; the classic one is gone from the repo; user's "Correct" DOM is the classic). svgcanvas is MIT, zero-deps, actively maintained (7.4.2, 2026‑07‑11), no CDN, `setMode`/`undo`/`setZoom`/`changeSelectedAttribute`/`getSvgString` = a real vector editor API.
License note: use ONLY `@svgedit/svgcanvas` (MIT). Do NOT use the `svgedit` full-app package (LGPL‑3.0-or-later + jQuery mix — same class of license problem as rejected JointJS).

Source format decision: **`.svg` text = the document** (per user's Aug-2026 product decision: format need not be .drawio; must stay editable + vector PDF-exportable).
- Editor binds to `.svg` documents (replaces `.drawio` binding). Old `.drawio` files remain open/readable as plain source; no editor UI for them.
- Round-trip: `canvas.setSvgString(doc)` on open; `canvas.getSvgString()` on Save.
- Vector PDF + PNG companions via existing svg2pdf.js + jsPDF pipeline (drawio-export.ts), naming from doc basename (`diagram.svg` → `diagram.png`, `diagram.pdf`).

UI (minimal, replaces current dg-* UI):
- Modes via `canvas.setMode`: select (default), rectangle, ellipse, line, draw (freehand), text.
- Selection styling: fill color, stroke color, stroke width (`changeSelectedAttribute`), apply on existing selection like before.
- Order: front/back (`moveToTopSelectedElement`/`moveToBottomSelectedElement`).
- Undo/redo (`undoMgr`/`undo()`/`redo()`), zoom (`setZoom`), zoom fit (set contentW/origin or just zoom presets).
- Delete (Delete key + button), Clear.
- Save (doc round-trip + companions) as before; status pill; keyboard Delete/Ctrl+Z/Ctrl+Shift+Z.
- New-file flow: create `.svg` with a blank SVG skeleton.

Wiring changes:
- services/web/config/settings.defaults.js: textExtensions 'svg' (drop 'drawio'), sourceEditorComponents for .svg, createFileMode label 'SVG diagram' (or keep 'Diagram'), moduleImportSequence unchanged (module dir remains `drawio` to minimize churn).
- file-view-header: unchanged (Edit button only for raster images — toast-image).
- package.json: add `@svgedit/svgcanvas`; remove `@maxgraph/core`.

Verification gates (strict — no "fixed" claims without these):
1. vitest (modules/drawio + modules/toast-image tests; adjust drawio-model tests for SVG)
2. eslint (repo-local flat config)
3. tsc --noEmit delta vs pre-change baseline
4. Docker `cd server-ce && make all` (babel is stricter than tsc — final arbiter)
5. Deploy compose cycle → browser E2E (CDP script, testjoe@rotermund.at):
   - TUI: open frog.jpg → no console error; canvas + menus visible; save gate disabled until load; screenshot.
   - Diagram: create .svg → draw rect+line+freehand → recolor → undo/redo → Save → doc text is SVG; reopen .svg → shapes present; companions .png/.pdf exist in project; screenshot of both.

## Session state / evidence artifacts
- /tmp/svgcanvas-pkg/package = extracted @svgedit/svgcanvas@7.4.2 (API + license verified here)
- /tmp/mgx-example/mxgraph = mxgraph master clone (grapheditor example = drawio-grade files; classic diagramly gone)
- dist line numbers above are from node_modules/tui-image-editor@3.15.3 in /root/junk_image/overleaf
