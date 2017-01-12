define [
	"base"
], (App) ->
	App.directive "commentEntry", () ->
		restrict: "E"
		templateUrl: "commentEntryTemplate"
		scope: 
			entry: "="
			threads: "="
			permissions: "="
			onResolve: "&"
			onReply: "&"
			onIndicatorClick: "&"
		link: (scope, element, attrs) ->
			scope.handleCommentReplyKeyPress = (ev) ->
				if ev.keyCode == 13 and !ev.shiftKey and !ev.ctrlKey and !ev.metaKey
					ev.preventDefault()
					ev.target.blur()
					scope.onReply()
		