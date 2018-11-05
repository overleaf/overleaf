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
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('ChatButtonController', function($scope, ide) {
    let clearNewMessageNotification
    $scope.toggleChat = function() {
      $scope.ui.chatOpen = !$scope.ui.chatOpen
      return $scope.resetUnreadMessages()
    }

    $scope.unreadMessages = 0
    $scope.resetUnreadMessages = () => ($scope.unreadMessages = 0)

    $scope.$on('chat:resetUnreadMessages', e => $scope.resetUnreadMessages())

    $scope.$on('chat:newMessage', function(e, message) {
      if (message != null) {
        if (
          __guard__(message != null ? message.user : undefined, x => x.id) !==
          ide.$scope.user.id
        ) {
          if (!$scope.ui.chatOpen) {
            $scope.unreadMessages += 1
          }
          return flashTitle()
        }
      }
    })

    let focussed = true
    let newMessageNotificationTimeout = null
    let originalTitle = null
    $(window).on('focus', function() {
      clearNewMessageNotification()
      return (focussed = true)
    })
    $(window).on('blur', () => (focussed = false))

    var flashTitle = function() {
      if (!focussed && newMessageNotificationTimeout == null) {
        let changeTitle
        if (!originalTitle) {
          originalTitle = window.document.title
        }
        return (changeTitle = () => {
          if (window.document.title === originalTitle) {
            window.document.title = 'New Message'
          } else {
            window.document.title = originalTitle
          }
          return (newMessageNotificationTimeout = setTimeout(changeTitle, 800))
        })()
      }
    }

    return (clearNewMessageNotification = function() {
      clearTimeout(newMessageNotificationTimeout)
      newMessageNotificationTimeout = null
      if (originalTitle != null) {
        return (window.document.title = originalTitle)
      }
    })
  }))

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
