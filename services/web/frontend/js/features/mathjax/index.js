/* global MathJax */
import { configureMathJax } from './configure'
import { mathJaxLoaded } from './util'

function render(el) {
  if (!mathJaxLoaded()) return
  configureMathJax()

  setTimeout(() => {
    MathJax.Hub.Queue(['Typeset', MathJax.Hub, el])
  }, 0)
}

document.querySelectorAll('[data-ol-mathjax]').forEach(render)
