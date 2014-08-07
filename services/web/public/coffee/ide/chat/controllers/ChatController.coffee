define [
	"base"
	"ide/chat/services/chatMessages"
], (App) ->
	App.controller "ChatController", ($scope, chatMessages, ide, $location) ->
		$scope.chat = chatMessages.state
		
		$scope.$watch "chat.messages", (messages) ->
			if messages?
				$scope.$emit "updateScrollPosition"
		, true # Deep watch
		
		$scope.$on "layout:chat:resize", () ->
			$scope.$emit "updateScrollPosition"
			
		$scope.$watch "chat.newMessage", (message) ->
			if message?
				ide.$scope.$broadcast "chat:newMessage", message
				
		$scope.resetUnreadMessages = () ->
			ide.$scope.$broadcast "chat:resetUnreadMessages"
				
		$scope.sendMessage = ->
			message = $scope.newMessageContent
			$scope.newMessageContent = ""
			chatMessages
				.sendMessage message
				
		$scope.loadMoreMessages = ->
			chatMessages.loadMoreMessages()
			
			