/* eslint-disable
    max-len,
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
  App.directive('reviewPanelCollapseHeight', $parse => ({
    restrict: 'A',
    link(scope, element, attrs) {
      return scope.$watch(
        () => $parse(attrs.reviewPanelCollapseHeight)(scope),
        function(shouldCollapse) {
          const neededHeight = element.prop('scrollHeight')
          if (neededHeight > 0) {
            if (shouldCollapse) {
              return element.animate({ height: 0 }, 150)
            } else {
              return element.animate({ height: neededHeight }, 150)
            }
          } else {
            if (shouldCollapse) {
              return element.height(0)
            }
          }
        }
      )
    }
  })))
