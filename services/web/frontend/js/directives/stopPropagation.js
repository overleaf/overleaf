/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../base'
App.directive('stopPropagation', () => ({
  restrict: 'A',
  link(scope, element, attrs) {
    return element.bind(attrs.stopPropagation, e => e.stopPropagation())
  },
}))

export default App.directive('preventDefault', () => ({
  restrict: 'A',
  link(scope, element, attrs) {
    return element.bind(attrs.preventDefault, e => e.preventDefault())
  },
}))
