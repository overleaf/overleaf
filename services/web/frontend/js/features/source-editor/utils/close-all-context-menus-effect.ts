import { StateEffect } from '@codemirror/state'

// Effect used to ask any loaded menu/tooltip extension to close itself.
// Used to ensure only one context menu is open at a time.
export const closeAllContextMenusEffect = StateEffect.define<null>()
