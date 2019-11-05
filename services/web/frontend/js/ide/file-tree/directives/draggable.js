/* eslint-disable
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.directive('draggable', () => ({
    link(scope, element, attrs) {
      return scope.$watch(attrs.draggable, function(draggable) {
        if (draggable) {
          return element.draggable({
            delay: 250,
            opacity: 0.95,
            scroll: true,
            helper: scope.$eval(attrs.draggableHelper)
          })
        }
      })
    }
  })))
