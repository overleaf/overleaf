/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.directive('fileEntity', RecursionHelper => ({
    restrict: 'E',
    scope: {
      entity: '=',
      permissions: '='
    },
    templateUrl: 'entityListItemTemplate',
    compile(element) {
      return RecursionHelper.compile(element, function(
        scope,
        element,
        attrs,
        ctrl
      ) {
        // Don't freak out if we're already in an apply callback
        scope.$originalApply = scope.$apply
        return (scope.$apply = function(fn) {
          if (fn == null) {
            fn = function() {}
          }
          const phase = this.$root.$$phase
          if (phase === '$apply' || phase === '$digest') {
            return fn()
          } else {
            return this.$originalApply(fn)
          }
        })
      })
    }
  })))
