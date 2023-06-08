import { sourceOnly } from './visual/visual'
import { highlightSpecialChars as _highlightSpecialChars } from '@codemirror/view'

/**
 * The built-in extension which highlights unusual whitespace characters,
 * configured to highlight additional space characters.
 */
export const highlightSpecialChars = (visual: boolean) =>
  sourceOnly(
    visual,
    _highlightSpecialChars({
      addSpecialChars: new RegExp(
        // non standard space characters (https://jkorpela.fi/chars/spaces.html)
        '[\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u200B\u202F\u205F\u3000\uFEFF]',
        /x/.unicode != null ? 'gu' : 'g'
      ),
    })
  )
