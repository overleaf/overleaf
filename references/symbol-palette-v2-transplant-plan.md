# Symbol Palette v2 — transplant plan (branch `symbol_palette_v2`)

## Goal
Port the customizable-symbol-palette feature from the old CE+ fork
(`~/junk_symbol_palette/old`, branch `symbol-palette`, commit
`bee34ec39` "Initial files", based on `ext-ce` ~PR #32280 era) into the
current overleaf main tree (`~/junk_symbol_palette/overleaf`, HEAD
`28ad3b03b7`). Old base is NOT an ancestor of main; shared merge-base is
`c9c129af40` (PR #32280), so this is a manual re-port, not a 3-way merge.

## What the feature is (read from old code)
- User-customizable symbol palette (localStorage key
  `ol-symbol-palette-user-config`): custom categories + custom symbols,
  cross-context sync via window event `symbol-palette-config-changed`.
- V2 UX: palette lives in the **editor RAIL as a tab** (`key:
  'symbol-palette'`), opened from the toolbar "Symbol" command via
  `ui:select-rail-tab` event; palette moved OUT of the editor bottom
  PanelGroup. Symbol insertion = `editor:insert-symbol` window event →
  existing CM6 extension (`source-editor/extensions/symbol-palette.ts`).
- Settings page entry (settings modal) for managing categories/symbols:
  add/remove/rename/reorder categories, add/remove/edit/reorder symbols,
  export/import/reset to defaults.

## Old repo facts
- Module: `services/web/modules/symbol-palette/` (12 components, context,
  data/symbols.json 872 lines, utils/categories.js, index.mjs).
- ext-ce registered `sourceEditorSymbolPalette: [
  .../symbol-palette/frontend/components/symbol-palette ]` (base files
  were pre-existing on ext-ce; absent from main entirely).

## Main-repo facts (verified)
- `js/features/ide-react/components/editor/symbol-palette-pane.tsx` —
  bridge rendering `importOverleafModules('sourceEditorSymbolPalette')`.
- `js/features/source-editor/extensions/symbol-palette.ts` — CM6 listener
  for `editor:insert-symbol` (inserts `event.detail.command`).
- `rail.tsx` spreads `importOverleafModules('railEntries')` into rail tabs;
  has `ui:select-rail-tab` listener with detail `{tab, open}`.
- settings-modal-context.tsx exports/imports `SettingsEntry` type; main
  `settingsEntries: []` key present (line 1074).
- `rail-panel-header.tsx` present; `match-sorter` ^6.2.0 in deps.
- editor.tsx still has the old bottom-PanelGroup + `showSymbolPalette`
  (same shape as old base) → safe to replace.
- MB flows `symbol-palette-insert/-show/-hide` already present in main
  (editor-manager-context.tsx:611, editor-properties-context.tsx:103).
- main scss = 197 lines, identical tail to old base → append chunk OK.
- en.json: `symbol_palette` at line 2565; no `symbol_palette_highlighted`.
- `use-toolbar-menu-editor-commands.tsx` still calls
  `toggleSymbolPalette?.()` (line 354/374) — pre-v2 shape.

## Changes to make
1. COPY whole `services/web/modules/symbol-palette/` from old worktree.
2. `config/settings.defaults.js`: fill `sourceEditorSymbolPalette`,
   `settingsEntries`, `railEntries` with module paths.
3. `frontend/js/features/ide-react/components/layout/editor.tsx`: drop
   PanelGroup/symbol-palette panel; plain div layout (keep main's
   pythonRunner condition).
4. `frontend/js/features/ide-react/context/rail-context.tsx`: add
   `| 'symbol-palette'` to `RailTabKey`.
5. `frontend/js/features/settings/context/settings-modal-context.tsx`:
   spread `importOverleafModules('settingsEntries')` into tabs (before
   account_settings).
6. `frontend/js/features/source-editor/hooks/use-toolbar-menu-editor-commands.tsx`:
   toolbar `insert-symbol` → dispatch `ui:select-rail-tab`
   `{tab:'symbol-palette', open:true}`; drop toggleSymbolPalette.
7. `frontend/stylesheets/modules/symbol-palette.scss`: append old 136 lines
   (rail-panel layout + .sp-settings*).
8. `locales/en.json`: `symbol_palette` → "Symbol Palette"; +13 keys.
9. `frontend/extracted-translations.json`: +13 empty keys.

## Verification plan
- [x] eslint (services/web lint script) clean on touched + new files
- [x] tsc: 31 pre-existing CE-baseline TS2307 errors (missing CE+ modules), 0 in our files; symbol-palette ref fixed via type shim
- [x] stylelint clean (incl. fixed append seam + overflow shorthand)
- [x] getSymbolCharacter unit-checked (hex/custom/bad/huge/undefined)
- [ ] webpack build parity check (`make all` / docker image)
- [ ] live browser check (dev server): rail tab opens, symbol inserts in
      LaTeX code, settings page CRUD + export/import/reset, localStorage
      persistence, cross-instance sync event
- Commits: incremental at milestones; push `symbol_palette_v2` to
  origin=davrot/overleaf-cep. NO PRs (user handles PRs).

## Status
- [x] analysis complete (2026-08-27)
- [x] code port
- [x] deep audit + bug fixes (5 lint errors, character-derivation
      crashes, import sanitization, codepoint uniqueness, dead code)
- [x] lint/stylelint/typecheck (baseline-clean)
- [ ] live verification (awaiting deploy)
- [ ] commit + push
