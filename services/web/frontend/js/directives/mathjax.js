/* global MathJax */

import App from '../base'

export default App.directive('mathjax', function () {
  return {
    link(scope, element, attrs) {
      if (!(MathJax && MathJax.Hub)) return

      setTimeout(() => {
        MathJax.Hub.Queue(['Typeset', MathJax.Hub, element.get(0)])
      }, 0)
    },
  }
})
