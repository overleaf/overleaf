/* global MathJax */

export function mathJaxLoaded() {
  return !!(typeof MathJax !== 'undefined' && MathJax && MathJax.Hub)
}
