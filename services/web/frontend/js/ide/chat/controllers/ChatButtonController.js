/* eslint-disable
    max-len,
    no-return-assign,
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
import App from '../../../base'

export default App.controller('ChatButtonController', function ($scope, ide) {
  $scope.toggleChat = function () {
    $scope.ui.chatOpen = !$scope.ui.chatOpen
    return $scope.resetUnreadMessages()
  }

  $scope.unreadMessages = 0
  $scope.resetUnreadMessages = () => ($scope.unreadMessages = 0)

  function handleNewMessage(message) {
    if (message != null) {
      if (
        __guard__(message != null ? message.user : undefined, x => x.id) !==
        ide.$scope.user.id
      ) {
        if (!$scope.ui.chatOpen) {
          $scope.$applyAsync(() => {
            $scope.unreadMessages += 1
          })
        }
      }
    }
  }

  window.addEventListener('Chat.MessageReceived', ({ detail: { message } }) =>
    handleNewMessage(message)
  )
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
