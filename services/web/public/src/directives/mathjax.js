/* eslint-disable
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.directive('mathjax', () => ({
    link(scope, element, attrs) {
      if (attrs.delimiter !== 'no-single-dollar') {
        const inlineMathConfig = __guard__(
          __guard__(
            typeof MathJax !== 'undefined' && MathJax !== null
              ? MathJax.Hub
              : undefined,
            x1 => x1.config
          ),
          x => x.tex2jax.inlineMath
        )
        const alreadyConfigured = _.find(
          inlineMathConfig,
          c => c[0] === '$' && c[1] === '$'
        )

        if (alreadyConfigured == null) {
          __guard__(
            typeof MathJax !== 'undefined' && MathJax !== null
              ? MathJax.Hub
              : undefined,
            x2 =>
              x2.Config({
                tex2jax: {
                  inlineMath: inlineMathConfig.concat([['$', '$']])
                }
              })
          )
        }
      }

      return setTimeout(
        () =>
          __guard__(
            typeof MathJax !== 'undefined' && MathJax !== null
              ? MathJax.Hub
              : undefined,
            x3 =>
              x3.Queue([
                'Typeset',
                typeof MathJax !== 'undefined' && MathJax !== null
                  ? MathJax.Hub
                  : undefined,
                element.get(0)
              ])
          ),
        0
      )
    }
  })))
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
