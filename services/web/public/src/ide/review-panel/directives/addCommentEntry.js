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
  App.directive('addCommentEntry', () => ({
    restrict: 'E',
    templateUrl: 'addCommentEntryTemplate',
    scope: {
      onStartNew: '&',
      onSubmit: '&',
      onCancel: '&'
    },
    link(scope, element, attrs) {
      scope.state = {
        isAdding: false,
        content: ''
      }

      scope.$on('comment:start_adding', () => scope.startNewComment())

      scope.startNewComment = function() {
        scope.state.isAdding = true
        scope.onStartNew()
        return setTimeout(() => scope.$broadcast('comment:new:open'))
      }

      scope.cancelNewComment = function() {
        scope.state.isAdding = false
        return scope.onCancel()
      }

      scope.handleCommentKeyPress = function(ev) {
        if (ev.keyCode === 13 && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey) {
          ev.preventDefault()
          if (scope.state.content.length > 0) {
            return scope.submitNewComment()
          }
        }
      }

      return (scope.submitNewComment = function(event) {
        // If this is from a blur event from clicking on cancel, ignore it.
        if (event != null && event.type === 'blur') {
          if (
            // Includes relatedTarget workaround for Firefox
            $(event.relatedTarget).hasClass('rp-entry-button-cancel') ||
            $(event.originalEvent.explicitOriginalTarget).hasClass(
              'rp-entry-button-cancel'
            )
          ) {
            return true
          }
        }

        scope.onSubmit({ content: scope.state.content })
        scope.state.isAdding = false
        return (scope.state.content = '')
      })
    }
  })))
