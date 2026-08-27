# Toast Image editor module

Adds an **"Edit Image"** button to the file view header for raster images
(png/jpg/jpeg/gif). Clicking it opens a full-screen [TUI
Image Editor](https://ui.toastmark.com/tui-image-editor/next/en-US/) modal
(resize, filters, shapes, text, drawing, guides). Saving re-uploads the
edited image under the same file name (replacing the file), and the file view
is refreshed through the standard file-tree selection path — so the preview
shows the new bytes.

## Behaviour notes / fixes over the original CE+ version

- Deterministic editor init (waits for a non-zero container size; no blind
  `setTimeout` + `MutationObserver` button-hiding that made the canvas
  flaky).
- **Text-tool typing works inside the OL modal**: TUI's text editing uses a
  fabric canvas whose hidden `<textarea>` defaults to `document.body`; the
  modal's focus-trap reclaims focus from body-level elements and swallowed
  every keystroke. Fix: `graphics._canvas.hiddenTextareaContainer` is set
  to an in-modal host div, plus a safety-net reparenter that moves any
  stray `textarea[data-fabric-hiddentextarea]` from `document.body` into
  the modal and refocuses it.
- **Selected tool button visible in the dark theme**: TUI inverts the
  active tool item to a white background
  (`.tui-image-editor-item.active { background-color:#fff }`) while the
  theme keeps white text → an invisible selected button. The module theme
  now sets explicit dark text/border colours for the active state
  (`toast-image-editor.css`).
- Unsaved-changes guard: closing with unapplied edits asks for confirmation
  instead of silently discarding work.
- Verified save flow: `response.ok` checks on both the data-URL read and the
  upload, with user-visible error messages; TUI `usageStatistics` is off.
- Post-save refresh uses the file-tree-open context (re-select the replaced
  file) instead of a magic `file-view:file-opened` CustomEvent.
- A debug/E2E hook `window.__olTuiFabric()` exposes the real fabric canvas
  instance (read-only; used to verify keystroke capture from the outside).
- GIF is editable too (the file view already previews it).

## Dependencies

- `tui-image-editor` ^3.15 (MIT) — dynamically imported by this module only;
  it does not enter the main bundle.

## Testing

- `yarn test:unit` (vitest): `test/unit/src/toast-image-utils.test.mjs`
