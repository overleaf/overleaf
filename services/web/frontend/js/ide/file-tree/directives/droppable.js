/* eslint-disable
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../../../base'

export default App.directive('droppable', () => ({
  link(scope, element, attrs) {
    return scope.$watch(attrs.droppable, function(droppable) {
      if (droppable) {
        return element.droppable({
          greedy: true,
          hoverClass: 'droppable-hover',
          tolerance: 'pointer',
          accept: attrs.accept,
          drop: scope.$eval(attrs.onDropCallback)
        })
      }
    })
  }
}))
