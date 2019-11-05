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
  App.directive('equals', () => ({
    require: 'ngModel',
    link(scope, elem, attrs, ctrl) {
      const firstField = `#${attrs.equals}`
      return elem.add(firstField).on('keyup', () =>
        scope.$apply(function() {
          const equal = elem.val() === $(firstField).val()
          return ctrl.$setValidity('areEqual', equal)
        })
      )
    }
  })))
