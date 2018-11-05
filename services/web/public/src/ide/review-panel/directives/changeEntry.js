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
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.directive('changeEntry', $timeout => ({
    restrict: 'E',
    templateUrl: 'changeEntryTemplate',
    scope: {
      entry: '=',
      user: '=',
      permissions: '=',
      onAccept: '&',
      onReject: '&',
      onIndicatorClick: '&',
      onBodyClick: '&'
    },
    link(scope, element, attrs) {
      scope.contentLimit = 40
      scope.isCollapsed = true
      scope.needsCollapsing = false

      element.on('click', function(e) {
        if (
          $(e.target).is(
            '.rp-entry, .rp-entry-description, .rp-entry-body, .rp-entry-action-icon i'
          )
        ) {
          return scope.onBodyClick()
        }
      })

      scope.toggleCollapse = function() {
        scope.isCollapsed = !scope.isCollapsed
        return $timeout(() => scope.$emit('review-panel:layout'))
      }

      return scope.$watch(
        'entry.content.length',
        contentLength =>
          (scope.needsCollapsing = contentLength > scope.contentLimit)
      )
    }
  })))
