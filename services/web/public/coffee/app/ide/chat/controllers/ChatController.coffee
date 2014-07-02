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
			{ content: "Here are some longer messages to show what ti looks like when I say a lot!", timestamp: Date.now() - 20000, user: henry }
			{ content: "What about some maths? $x^2 = 1$?", timestamp: Date.now() - 22000, user: james2 }
			{ content: "Nope, that doesn't work yet!", timestamp: Date.now() - 45000, user: henry }
			{ content: "I'm running out of things to say.", timestamp: Date.now() - 56000, user: henry }
			{ content: "Yep, me too", timestamp: Date.now() - 100000, user: james }
			{ content: "Hmm, looks like we've had this conversation backwards", timestamp: Date.now() - 120000, user: james }
		]
	]