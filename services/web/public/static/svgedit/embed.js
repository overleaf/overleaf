/*
 * Overleaf diagram editor — host bridge for the embedded SVG-Edit app.
 *
 * Runs the full SVG-Edit 7.4.2 application (MIT/permissive OR-license, see
 * LICENSE) inside a same-origin iframe owned by the Overleaf diagram module
 * (`services/web/modules/diagram`). Overleaf's parent page is the source of
 * truth (the `.svg` document); this page provides the canvas, toolbars and
 * dialogs only.
 *
 * Bridge contract (same-origin, direct calls — no postMessage needed):
 *   window.__olSvgEmbed.ready        boolean, true once the app booted
 *   window.__olSvgEmbed.load(svg)    Promise<void> — replace canvas content
 *   window.__olSvgEmbed.getSvg()     string   — canvas content as SVG text
 *   window.__olSvgEmbed.onChanged(cb)  cb(svg) — debounced change notifier
 *
 * Data-safety rules the host enforces:
 *   - no auto-load of previously-cached content (storage excluded);
 *   - no storage prompt / cookie / beforeunload auto-save;
 *   - no third-party branding in the menu, title or serialized source.
 */
import Editor from './Editor.js'

const params = new URLSearchParams(location.search)
const fileName = params.get('name') || 'diagram.svg'

// Strip the canvas-library branding comment out of every serialised string
// so it can never leak into the Overleaf project source.
const BRAND_COMMENT = /<!--\s*Created with[^\n]*?-->/g
const stripBrand = (svg) => String(svg == null ? '' : svg).replace(BRAND_COMMENT, '')

const container = document.getElementById('container')
const svgEditor = new Editor(container)

/*
 * Neutral host configuration.
 *
 * - `noDefaultExtensions` + explicit extension list: the stock default set
 *   MINUS `ext-storage`. That extension is the source of the storage
 *   prompt, the `svgeditstore` cookie, the cached auto-load and the
 *   beforeunload auto-save (see `extensions/ext-storage/`) — none of which
 *   is wanted inside an embedded, parent-owned document.
 * - `noStorageOnLoad`: extra guard against any cached auto-load.
 * - `no_save_warning`: no browser "unsaved changes" leave prompt —
 *   Overleaf owns the project's save lifecycle.
 * - `imgPath` / `extPath` keep their defaults on purpose: they resolve
 *   against THIS document's base URL (/static/svgedit/), which is exactly
 *   where the vendored assets live.
 */
svgEditor.setConfig({
  noDefaultExtensions: true,
  extensions: [
    'ext-connector',
    'ext-eyedropper',
    'ext-grid',
    'ext-markers',
    'ext-panning',
    'ext-shapes',
    'ext-polystar',
    'ext-opensave',
    'ext-layer_view',
  ],
  noStorageOnLoad: true,
  no_save_warning: true,
})

svgEditor.init()

/*
 * Normalise the left-bar tail to the reference order (idempotent).
 */
function normaliseLeftBarOrder () {
  try {
    // Reference left-bar tail: tool_text, tool_shapelib, tool_image,
    // tools_polygon, tool_connect, tool_eyedropper. The extensions insert
    // their buttons by fixed index or append, and their inits resolve
    // asynchronously, so the tail order (and image's slot among them) is a
    // race. The head (select/zoom/panning/fhpath/line/path/rect/ellipse)
    // is deterministic (core + ext-panning inserts right after zoom) and is
    // left alone. All six ids below exist in the reference layout; moving
    // only between them is cosmetic and self-cancels (no-op once sorted).
    const tailPairs = [
      ['tool_text', 'tool_shapelib'],
      ['tool_shapelib', 'tool_image'],
      ['tool_image', 'tools_polygon'],
      ['tools_polygon', 'tool_connect'],
      ['tool_connect', 'tool_eyedropper'],
    ]
    for (const [a, c] of tailPairs) {
      const elA = document.getElementById(a)
      const elC = document.getElementById(c)
      if (!elA || !elC) continue
      if (elA.compareDocumentPosition(elC) & Node.DOCUMENT_POSITION_FOLLOWING) continue
      elA.after(elC)
    }
  } catch (e) {
    // Purely cosmetic; never break the editor over it.
  }
}

/*
 * Rebrand the app shell: drop the external home-page item, neutralise the
 * main-menu "SVG-Edit" label + logo, set a document title — and run the
 * host-side normalisations (left-bar tail order, file-op pruning, image
 * tool swap), all idempotent.
 */
function rebrand () {
  try {
    const homepage = document.getElementById('tool_editor_homepage')
    if (homepage) homepage.remove()

    const main = document.getElementById('main_button')
    const labelRoot = main
      ? main.shadowRoot
        ? main.shadowRoot.querySelector('elix-menu-button')
          ? main.shadowRoot
            .querySelector('elix-menu-button')
            .shadowRoot
            .querySelector('#popupToggle')
            .shadowRoot
          : null
        : null
      : null
    if (labelRoot) {
      for (const node of Array.from(labelRoot.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && /svg-?edit/i.test(node.textContent)) {
          node.textContent = node.textContent.replace(/svg-?edit/gi, 'Diagram')
        }
      }
      labelRoot.querySelectorAll('img[alt="logo"]').forEach((img) => img.remove())
    }

    if (svgEditor.topPanel && typeof svgEditor.topPanel.updateTitle === 'function') {
      svgEditor.topPanel.updateTitle(fileName)
    }
    document.title = fileName

    const storage = document.getElementById('se-storage-dialog')
    if (storage) storage.remove()

    pruneDangerousFileOps()
    normaliseLeftBarOrder()
    wireImageToolToFileDialog()
  } catch (e) {
    // Rebranding is cosmetic; never break the editor over it.
  }
}

/*
 * Remove the client-side file operations that are unsafe inside Overleaf.
 * The parent owns the document (every canvas change syncs into the `.svg`
 * through onChanged), so these menu items can only cost or confuse data:
 *   - New (tool_clear)  -> clears the canvas -> a cleared canvas syncs to
 *     the document (content loss)
 *   - Open (tool_open)  -> svgCanvas.clear() + load a local disk file -> the
 *     foreign content overwrites the document
 *   - Save / Save as    -> File-System-Access browser download. Looks like a
 *     save, stores nothing in the project
 * Kept on purpose:
 *   - Import (tool_import): embeds the chosen file as a data URI (raster)
 *     or inline SVG, or supports drop-to-import — content that is safe
 *     inside an Overleaf-owned document
 *   - the Image tool (core): a canvas URL/path href mode the user may still
 *     want (postponed removal)
 *
 * Warning (why the key blocker below is mandatory): these se-menu-item
 * elements register their shortcut keys ("N", "S") as keydown listeners on
 * the whole DOCUMENT in their connectedCallback, and those listeners are
 * never removed when the element is detached — the handlers keep firing.
 * A capture-phase blocker covering exactly their firing conditions (bare
 * N/S, no modifiers, target = BODY = canvas focused) replaces them.
 */
function pruneDangerousFileOps () {
  for (const id of ['tool_clear', 'tool_open', 'tool_save', 'tool_save_as']) {
    const el = document.getElementById(id)
    if (el) el.remove()
  }
  if (window.__olKeyBlocker) return
  window.__olKeyBlocker = true
  document.addEventListener('keydown', (e) => {
    if (e.target && e.target.nodeName === 'BODY' 
      && !e.ctrlKey && !e.metaKey && !e.altKey
      && (e.key === 'n' || e.key === 'N' || e.key === 's' || e.key === 'S')) {
      e.stopImmediatePropagation()
      e.preventDefault()
    }
  }, true)
}

window.__olImageToolWired = false
function wireImageToolToFileDialog () {
  if (window.__olImageToolWired) return
  const old = document.getElementById('tool_image')
  if (!old) {
    setTimeout(wireImageToolToFileDialog, 300)
    return
  }
  const bar = old.parentElement
  // Replace the core URL-prompt tool (typed paths produce broken <image>
  // references in a parent-owned document) with a local-file-dialog tool.
  // User decision (option a, preferred): click → file dialog → the chosen
  // file is embedded (SVG inline, raster as data URI), exactly like the
  // opensave Import / drop-to-import path, so the result is portable
  // content inside the Overleaf document.
  const replacement = document.createElement('se-button')
  replacement.setAttribute('id', 'tool_image')
  replacement.setAttribute('title', 'Add image: choose an image file from your computer')
  replacement.setAttribute('src', 'image.svg')
  replacement.dataset.olImageTool = 'file-dialog'

  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = 'image/svg+xml,image/png,image/jpeg,image/webp,image/gif'
  fileInput.className = 'ol-image-file-input'
  fileInput.style.display = 'none'
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0]
    const reset = () => {
      fileInput.value = ''
      try { svgEditor.topPanel.updateContextPanel() } catch (e) { /* ignore */ }
    }
    if (!file) return
    let svgCanvas = null
    try { svgCanvas = svgEditor.svgCanvas } catch (e) { /* ignore */ }
    if (!svgCanvas) return
    const fail = (err) => {
      // eslint-disable-next-line no-console
      console.warn('diagram embed: image import failed', err)
      reset()
    }
    try {
      if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
        const reader = new FileReader()
        reader.onloadend = () => {
          try {
            svgCanvas.importSvgString(String(reader.result), false)
            svgCanvas.alignSelectedElements('m', 'page')
            svgCanvas.alignSelectedElements('c', 'page')
            reset()
          } catch (err) { fail(err) }
        }
        reader.onerror = fail
        reader.readAsText(file)
        return
      }
      const reader = new FileReader()
      reader.onloadend = ({ target }) => {
        const result = target.result
        const finish = (width, height) => {
          try {
            const el = svgCanvas.addSVGElementsFromJson({
              element: 'image',
              attr: {
                x: 0,
                y: 0,
                width,
                height,
                style: 'pointer-events:inherit'
              }
            })
            svgCanvas.setHref(el, result)
            // The core add path skips the undo stack; without this the image
            // would be impossible to remove via undo/redo (the SVG file import
            // registers itself — see importSvgString in the bundle).
            registerImportInHistory(svgCanvas, el)
            svgCanvas.selectOnly([el])
            svgCanvas.alignSelectedElements('m', 'page')
            svgCanvas.alignSelectedElements('c', 'page')
            reset()
          } catch (err) { fail(err) }
        }
        const img = new Image()
        img.addEventListener('load', () => {
          finish(img.naturalWidth || img.width || 100, img.naturalHeight || img.height || 100)
        })
        // Decode failed: do NOT leave a broken placeholder on the canvas.
        img.addEventListener('error', () => fail(new Error('image could not be decoded')))
        img.src = result
      }
      reader.onerror = fail
      reader.readAsDataURL(file)
    } catch (err) {
      fail(err)
    }
  })
  replacement.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    try { svgEditor.leftPanel.updateLeftPanel('tool_image') } catch (e) { /* ignore */ }
    fileInput.click()
  })
  // Keep the input OUT of the toolbar container (it would become a
  // foreign child of the left bar and show up in toolbar inventories).
  document.body.appendChild(fileInput)
  bar.insertBefore(replacement, old)
  old.remove()
  window.__olImageToolWired = true
}

// The core add path (addSVGElementsFromJson) appends the element but skips
// the undo stack, so an imported <image> would stay on the canvas through
// undo/redo. Register it in the editor's own command stack, exactly like the
// core SVG-file import does (new BatchCommand + InsertElementCommand +
// addCommandToHistory). Best-effort: if the API shape changes, the import
// still lands on the canvas.
function registerImportInHistory (svgCanvas, el) {
  try {
    const hist = svgCanvas.history
    if (!el || !hist || !hist.InsertElementCommand || !hist.BatchCommand) return
    const batch = new hist.BatchCommand('Import image')
    batch.addSubCommand(new hist.InsertElementCommand(el))
    if (batch.isEmpty()) return
    svgCanvas.addCommandToHistory(batch)
    // Mirror the core import flow: notify the changed listeners so the
    // parent document picks the image up immediately.
    if (typeof svgCanvas.call === 'function') {
      svgCanvas.call('changed', [svgCanvas.getSvgContent()])
    }
  } catch (err) {
    // no-op: the image stays on the canvas even if history registration fails
  }
}

// An extension may insert its button (or re-insert by fixed index) AFTER a
// rebrand run, undoing the normalisation. Watch the left bar's direct
// children and re-apply 120 ms after the last change; the pass is a no-op
// once the order is stable, so this converges.
window.__olLeftTailGuard = false
function attachLeftTailGuard () {
  const bar = document.getElementById('tools_left')
  if (!bar) {
    setTimeout(attachLeftTailGuard, 300)
    return
  }
  if (window.__olLeftTailGuard) return
  window.__olLeftTailGuard = true
  let timer = null
  new MutationObserver(() => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(normaliseLeftBarOrder, 120)
  }).observe(bar, { childList: true })
  // The editor's main menu: ext-opensave inserts its items asynchronously,
  // and if that happens AFTER the last rebrand timestamp, the dangerous
  // items (New/Open/Save/Save as) would survive. Re-prune on any child
  // change; the prune is idempotent, so this converges.
  const menu = document.getElementById('main_button')
  if (menu && !window.__olMenuPruneGuard) {
    window.__olMenuPruneGuard = true
    new MutationObserver(() => {
      setTimeout(pruneDangerousFileOps, 50)
    }).observe(menu, { childList: true })
  }
}
attachLeftTailGuard()

// `svgedit:ready` fires at the end of init() (after the ready queue ran).
document.addEventListener('svgedit:ready', rebrand)
// Extensions attach asynchronously; run again shortly after in case any
// UI node lands while we are mid-boot.
setTimeout(rebrand, 400)
setTimeout(rebrand, 1500)

/*
 * Right-click context menu fit-up (canvas menu + layer menus).
 *
 * Upstream svg-edit positions its context menus at raw cursor page
 * coordinates, clamped only by `screen.width - 250` / `screen.height -
 * 426` — i.e. the HOST OS SCREEN (standalone svg-edit runs full-window).
 * Embedded inside the Overleaf editor pane that clamp is meaningless: on a
 * small screen it drags the menu far AWAY from the cursor, on a large one
 * it lets the menu run past the right/bottom edge of the IFRAME viewport
 * where it is clipped — items (or the whole menu) become unreachable. The
 * layer menus have no clamping at all.
 *
 * Host-side fix (no vendored-bundle edits): svg-edit binds its openers to
 * `contextmenu`/`click` listeners on the inner workarea elements, so a
 * DOCUMENT-level listener (bubble phase) runs right after the bundle has
 * written its inline `top`/`left`. We then re-place each currently visible
 * menu: follow the cursor when it fits, pin flush to the viewport edge
 * when it does not (never beyond it).
 */
function clampContextMenusToViewport (event) {
  try {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const px = event && Number.isFinite(event.pageX) ? event.pageX : null
    const py = event && Number.isFinite(event.pageY) ? event.pageY : null
    const hosts = document.querySelectorAll('se-cmenu_canvas-dialog, se-cmenu-layers')
    for (const host of Array.from(hosts)) {
      if (!host.shadowRoot) continue
      for (const menu of Array.from(host.shadowRoot.querySelectorAll('.contextMenu'))) {
        if (menu.style.display === 'none') continue // closed: leave as-is
        const rect = menu.getBoundingClientRect()
        if (!rect.width || !rect.height) continue
        // Anchor at the cursor (upstream intent: menu top-left at the
        // cursor). Upstream's own clamp (screen.width/height) is wrong in
        // an embedded pane, so it is *replaced*, not extended. Pin flush to
        // the viewport edge (top-left if it doesn't even fit) when the
        // menu would overflow the viewport below/right of the cursor.
        const ax = px != null ? px : parseFloat(menu.style.left)
        const ay = py != null ? py : parseFloat(menu.style.top)
        if (Number.isNaN(ax) || Number.isNaN(ay)) continue
        const x = Math.max(0, Math.min(ax, vw - rect.width))
        const y = ay + rect.height <= vh
          ? Math.max(0, ay)
          : Math.max(0, vh - rect.height)
        menu.style.left = x + 'px'
        menu.style.top = y + 'px'
      }
    }
  } catch (e) {
    // Pure positioning assistance; never break the editor over it.
  }
}
document.addEventListener('contextmenu', clampContextMenusToViewport)
document.addEventListener('click', clampContextMenusToViewport)

const api = {
  ready: false,
  load (svg) {
    return Promise.resolve()
      .then(() => svgEditor.loadFromString(stripBrand(svg), { noAlert: true }))
      .catch((err) => {
        // Surface to the console; the parent sees the rejection.
        // eslint-disable-next-line no-console
        console.warn('diagram embed: failed to load SVG content', err)
        throw err
      })
      .then(() => rebrand())
  },
  getSvg () {
    const canvas = svgEditor.svgCanvas
    if (!canvas) return ''
    try {
      return stripBrand(canvas.svgCanvasToString())
    } catch (err) {
      try {
        return stripBrand(canvas.getSvgString())
      } catch (err2) {
        return ''
      }
    }
  },
  onChanged (cb) {
    // Debounce: a drag fires 'changed' continuously; the parent only ever
    // needs the latest serialised state.
    let scheduled = false
    let timer = null
    const notify = () => {
      if (scheduled) return
      scheduled = true
      timer = setTimeout(() => {
        scheduled = false
        try {
          cb(api.getSvg())
        } catch (e) {
          // Parent window gone (tab closed) — nothing to do.
        }
      }, 150)
    }
    // Attach on the next microtask so a synchronous init() has finished
    // wiring the canvas event system.
    setTimeout(() => {
      const canvas = svgEditor.svgCanvas
      if (!canvas) return
      try {
        canvas.bind('changed', notify)
        canvas.bind('canvasUpdated', notify)
        canvas.bind('selectedChanged', notify)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('diagram embed: change listeners failed', e)
      }
    }, 0)
    return () => {
      if (timer) clearTimeout(timer)
    }
  },
}
window.__olSvgEmbed = api

// Flip the flag as soon as the init chain's ready queue completes. `ready`
// resolves immediately if it has already run.
Promise.resolve()
  .then(() => svgEditor.ready(() => undefined))
  .then(() => {
    api.ready = true
    rebrand()
  })
  .catch(() => {
    // eslint-disable-next-line no-console
    console.warn('diagram embed: readiness queue failed')
  })
