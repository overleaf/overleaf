/* global MathJax */
import _ from 'lodash'
import { configureMathJax } from './configure'
import { mathJaxLoaded } from './util'

function render(el) {
  if (!mathJaxLoaded()) return
  configureMathJax()

  if (!el.hasAttribute('data-ol-no-single-dollar')) {
    const inlineMathConfig =
      MathJax.Hub.config &&
      MathJax.Hub.config.tex2jax &&
      MathJax.Hub.config.tex2jax.inlineMath
    const alreadyConfigured = _.find(
      inlineMathConfig,
      c => c[0] === '$' && c[1] === '$'
    )

    if (!alreadyConfigured) {
      MathJax.Hub.Config({
        tex2jax: {
          inlineMath: inlineMathConfig.concat([['$', '$']]),
        },
      })
    }
  }

  setTimeout(() => {
    MathJax.Hub.Queue(['Typeset', MathJax.Hub, el])
  }, 0)
}

document.querySelectorAll('[data-ol-mathjax]').forEach(render)
