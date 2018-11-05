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
  App.directive('expandableTextArea', () => ({
    restrict: 'A',
    link(scope, el) {
      const resetHeight = function() {
        const curHeight = el.outerHeight()
        const fitHeight = el.prop('scrollHeight')

        if (fitHeight > curHeight && el.val() !== '') {
          scope.$emit('expandable-text-area:resize')
          return el.css('height', fitHeight)
        }
      }

      return scope.$watch(() => el.val(), resetHeight)
    }
  })))
