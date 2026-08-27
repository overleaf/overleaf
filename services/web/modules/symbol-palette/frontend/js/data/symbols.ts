/**
 * Symbol shape shared with the editor context.
 *
 * Data comes from `../../data/symbols.json` (defaults) plus user
 * customizations stored in localStorage; `character` may be derived at
 * runtime from `codepoint` (see `../../utils/symbol-character.js`).
 */
export type SymbolWithCharacter = {
  category: string
  command: string
  codepoint: string
  description: string
  character?: string
  aliases?: string[]
  notes?: string
}
