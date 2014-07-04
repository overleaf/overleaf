define [
	"base"
], (App) ->
	App.controller "ChatController", ["$scope", ($scope) ->
		james = {
			id: $scope.user.id
			first_name: "James"
			last_name: "Allen"
			email: "james@sharelatex.com"
		}
		james2 = {
			id: "james2-id"
			first_name: "James"
			last_name: "Allen"
			email: "jamesallen0108@gmail.com"
		}
		henry = {
			id: "henry-id"
			first_name: "Henry"
			last_name: "Oswald"
			email: "henry.oswald@sharelatex.com"
		}
		$scope.chat.messages = [
			{ content: "Hello world", timestamp: Date.now() - 2000, user: james2 }
			{ content: "Hello, this is the new chat", timestamp: Date.now() - 4000, user: james }
			{ content: "Here are some longer messages to show what it looks like when I say a lot!", timestamp: Date.now() - 20000, user: henry }
			{ content: "What about some maths? $x^2 = 1$?", timestamp: Date.now() - 22000, user: james2 }
			{ content: "Nope, that doesn't work yet!", timestamp: Date.now() - 45000, user: henry }
			{ content: "I'm running out of things to say.", timestamp: Date.now() - 56000, user: henry }
			{ content: "Yep, me too", timestamp: Date.now() - 100000, user: james }
			{ content: "Hmm, looks like we've had this conversation backwards", timestamp: Date.now() - 120000, user: james }
			{ content: "Hello world", timestamp: Date.now() - 202000, user: james2 }
			{ content: "Hello, this is the new chat", timestamp: Date.now() - 204000, user: james }
			{ content: "Here are some longer messages to show what it looks like when I say a lot!", timestamp: Date.now() - 2020000, user: henry }
			{ content: "What about some maths? $x^2 = 1$?", timestamp: Date.now() - 12022000, user: james2 }
			{ content: "Nope, that doesn't work yet!", timestamp: Date.now() - 12045000, user: henry }
			{ content: "I'm running out of things to say.", timestamp: Date.now() - 22056000, user: henry }
			{ content: "Yep, me too", timestamp: Date.now() - 220100000, user: james }
			{ content: "Hmm, looks like we've had this conversation backwards", timestamp: Date.now() - 520120000, user: james }
		].reverse()

		$scope.$watch "chat.messages", (messages) ->
			if messages?
				$scope.chat.groupedMessages = groupMessages(messages)

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