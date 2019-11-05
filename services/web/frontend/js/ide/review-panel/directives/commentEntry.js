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
  App.directive('commentEntry', $timeout => ({
    restrict: 'E',
    templateUrl: 'commentEntryTemplate',
    scope: {
      entry: '=',
      threads: '=',
      permissions: '=',
      onResolve: '&',
      onReply: '&',
      onIndicatorClick: '&',
      onSaveEdit: '&',
      onDelete: '&',
      onBodyClick: '&'
    },
    link(scope, element, attrs) {
      scope.state = { animating: false }

      element.on('click', function(e) {
        if (
          $(e.target).is(
            '.rp-entry, .rp-comment-loaded, .rp-comment-content, .rp-comment-reply, .rp-entry-metadata'
          )
        ) {
          return scope.onBodyClick()
        }
      })

      scope.handleCommentReplyKeyPress = function(ev) {
        if (ev.keyCode === 13 && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey) {
          ev.preventDefault()
          if (scope.entry.replyContent.length > 0) {
            ev.target.blur()
            return scope.onReply()
          }
        }
      }

      scope.animateAndCallOnResolve = function() {
        scope.state.animating = true
        element.find('.rp-entry').css('top', 0)
        $timeout(() => scope.onResolve(), 350)
        return true
      }

      scope.startEditing = function(comment) {
        comment.editing = true
        return setTimeout(() => scope.$emit('review-panel:layout'))
      }

      scope.saveEdit = function(comment) {
        comment.editing = false
        return scope.onSaveEdit({ comment })
      }

      scope.confirmDelete = function(comment) {
        comment.deleting = true
        return setTimeout(() => scope.$emit('review-panel:layout'))
      }

      scope.cancelDelete = function(comment) {
        comment.deleting = false
        return setTimeout(() => scope.$emit('review-panel:layout'))
      }

      scope.doDelete = function(comment) {
        comment.deleting = false
        return scope.onDelete({ comment })
      }

      return (scope.saveEditOnEnter = function(ev, comment) {
        if (ev.keyCode === 13 && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey) {
          ev.preventDefault()
          return scope.saveEdit(comment)
        }
      })
    }
  })))
