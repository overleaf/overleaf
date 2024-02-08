import { loadMathJax } from '@/features/mathjax/load-mathjax'
import { debugConsole } from '@/utils/debugging'
import getMeta from '@/utils/meta'

window.addEventListener('DOMContentLoaded', function () {
  const elements = document.querySelectorAll('[data-ol-mathjax]')
  if (elements.length > 0) {
    loadMathJax({
      enableMenu: true,
      numbering: 'ams',
      singleDollar: !getMeta('ol-no-single-dollar'),
      useLabelIds: true,
    })
      .then(MathJax => MathJax.typesetPromise([...elements]))
      .catch(debugConsole.error)
  }
})
