import _ from 'lodash'
/* global MathJax */

import App from '../base'

export default App.directive('mathjax', function ($compile, $parse) {
  return {
    link(scope, element, attrs) {
      if (!(MathJax && MathJax.Hub)) return

      if (attrs.delimiter !== 'no-single-dollar') {
        const inlineMathConfig =
          MathJax.Hub.config && MathJax.Hub.config.tex2jax.inlineMath
        const alreadyConfigured = _.find(
          inlineMathConfig,
          c => c[0] === '$' && c[1] === '$'
        )

        if (!alreadyConfigured) {
          MathJax.Hub.Config({
            tex2jax: {
              inlineMath: inlineMathConfig.concat([['$', '$']])
            }
          })
        }
      }

      setTimeout(() => {
        MathJax.Hub.Queue(['Typeset', MathJax.Hub, element.get(0)])
      }, 0)
    }
  }
})
