define [
	"base"
], (App) ->
	App.controller "ChatController", ["$scope", "$http", "ide", "$location", ($scope, $http, @ide, $location) ->
		MESSAGES_URL = "/project/#{$scope.project_id}/messages"

		$scope.$on "project:joined", =>
			@ide.socket.on "new-chat-message", (message) =>
				$scope.chat.messages.push(message)

		$http.get(MESSAGES_URL).success (data, status, headers, config)->
			$scope.chat.messages = data

		$scope.$watchCollection "chat.messages", (messages) ->
			if messages?
				console.log "grouping messages"
				$scope.chat.groupedMessages = groupMessages(messages)

		$scope.sendMessage = ->
			body = 
				content:$scope.newMessageContent
				_csrf : window.csrfToken
			$http.post(MESSAGES_URL, body).success (data, status, headers, config)->
				$scope.newMessageContent = ""

		TIMESTAMP_GROUP_SIZE = 5 * 60 * 1000 # 5 minutes
		groupMessages = (messages) ->
			previousMessage = null
			groupedMessages = []
			for message in messages
				shouldGroup = previousMessage? and
					previousMessage.user == message.user and
					message.timestamp - previousMessage.timestamp < TIMESTAMP_GROUP_SIZE
				if shouldGroup
					previousMessage.timestamp = message.timestamp
					previousMessage.contents.push message.content
				else
					groupedMessages.push(previousMessage = {
						user: message.user
						timestamp: message.timestamp
						contents: [message.content]
					})
			return groupedMessages
	]