import App from '../../../base'
import { react2angular } from 'react2angular'
import ChatPane from '../components/chat-pane'

App.controller('ReactChatController', function($scope, chatMessages, ide) {
  ide.$scope.$on('chat:more-messages-loaded', onMoreMessagesLoaded)
  function onMoreMessagesLoaded(e, chat) {
    ide.$scope.$applyAsync(() => {
      $scope.atEnd = chatMessages.state.atEnd
      $scope.loading = chat.state.loading
      $scope.messages = chat.state.messages.slice(0) // passing a new reference to trigger a prop update on react
    })
  }

  ide.$scope.$on('chat:more-messages-loading', onMoreMessagesLoading)
  function onMoreMessagesLoading(e, chat) {
    ide.$scope.$applyAsync(() => {
      $scope.loading = true
    })
  }

  function sendMessage(message) {
    if (message) {
      chatMessages.sendMessage(message)
      ide.$scope.$broadcast('chat:newMessage', message)
    }
  }

  function resetUnreadMessages() {
    ide.$scope.$broadcast('chat:resetUnreadMessages')
  }

  $scope.atEnd = chatMessages.state.atEnd
  $scope.loading = chatMessages.state.loading
  $scope.loadMoreMessages = chatMessages.loadMoreMessages
  $scope.messages = chatMessages.state.messages
  $scope.resetUnreadMessages = resetUnreadMessages
  $scope.sendMessage = sendMessage
  $scope.userId = ide.$scope.user.id
})

App.component('chat', react2angular(ChatPane))
