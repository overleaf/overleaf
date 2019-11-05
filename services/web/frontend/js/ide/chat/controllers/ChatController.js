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
define(['base', 'ide/chat/services/chatMessages'], App =>
  App.controller('ChatController', function(
    $scope,
    chatMessages,
    ide,
    $location
  ) {
    $scope.chat = chatMessages.state

    $scope.$watch(
      'chat.messages',
      function(messages) {
        if (messages != null) {
          return $scope.$emit('updateScrollPosition')
        }
      },
      true
    ) // Deep watch

    $scope.$on('layout:chat:resize', () => $scope.$emit('updateScrollPosition'))

    $scope.$watch('chat.newMessage', function(message) {
      if (message != null) {
        return ide.$scope.$broadcast('chat:newMessage', message)
      }
    })

    $scope.resetUnreadMessages = () =>
      ide.$scope.$broadcast('chat:resetUnreadMessages')

    $scope.sendMessage = function() {
      const message = $scope.newMessageContent
      $scope.newMessageContent = ''
      return chatMessages.sendMessage(message)
    }

    return ($scope.loadMoreMessages = () => chatMessages.loadMoreMessages())
  }))
