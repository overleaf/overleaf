define [
	"base"
], (App) ->
	App.controller "ChatButtonController", ["$scope", ($scope) ->
		$scope.toggleChat = () ->
			$scope.ui.chatOpen = !$scope.ui.chatOpen
	]