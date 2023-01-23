/* global MathJax */

import { mathJaxLoaded } from './util'
import getMeta from '../../utils/meta'

let configured = false

export function configureMathJax() {
  if (configured) return
  if (getMeta('ol-mathJax3Path')) return
  if (!mathJaxLoaded()) return

  const inlineMath = [['\\(', '\\)']]

  if (!getMeta('ol-no-single-dollar')) {
    inlineMath.push(['$', '$'])
  }

  MathJax.Hub.Config({
    messageStyle: 'none',
    imageFont: null,
    // Fast preview, introduced in 2.5, is unhelpful due to extra codemirror refresh
    // and disabling it avoids issues with math processing errors
    // github.com/overleaf/write_latex/pull/1375
    'fast-preview': { disabled: true },
    'HTML-CSS': {
      availableFonts: ['TeX'],
      // MathJax's automatic font scaling does not work well when we render math
      // that isn't yet on the page, so we disable it and set a global font
      // scale factor
      scale: 110,
      matchFontHeight: false,
    },
    TeX: {
      equationNumbers: { autoNumber: 'AMS' },
      useLabelIDs: false,
    },
    skipStartupTypeset: true,
    tex2jax: {
      processEscapes: true,
      inlineMath,
      displayMath: [
        ['$$', '$$'],
        ['\\[', '\\]'],
      ],
    },
  })
  configured = true
}
