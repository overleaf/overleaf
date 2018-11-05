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
  App.directive('aggregateChangeEntry', $timeout => ({
    restrict: 'E',
    templateUrl: 'aggregateChangeEntryTemplate',
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
      scope.contentLimit = 17
      scope.isDeletionCollapsed = true
      scope.isInsertionCollapsed = true
      scope.deletionNeedsCollapsing = false
      scope.insertionNeedsCollapsing = false

      element.on('click', function(e) {
        if (
          $(e.target).is(
            '.rp-entry, .rp-entry-description, .rp-entry-body, .rp-entry-action-icon i'
          )
        ) {
          return scope.onBodyClick()
        }
      })

      scope.toggleDeletionCollapse = function() {
        scope.isDeletionCollapsed = !scope.isDeletionCollapsed
        return $timeout(() => scope.$emit('review-panel:layout'))
      }

      scope.toggleInsertionCollapse = function() {
        scope.isInsertionCollapsed = !scope.isInsertionCollapsed
        return $timeout(() => scope.$emit('review-panel:layout'))
      }

      scope.$watch(
        'entry.metadata.replaced_content.length',
        deletionContentLength =>
          (scope.deletionNeedsCollapsing =
            deletionContentLength > scope.contentLimit)
      )

      return scope.$watch(
        'entry.content.length',
        insertionContentLength =>
          (scope.insertionNeedsCollapsing =
            insertionContentLength > scope.contentLimit)
      )
    }
  })))
