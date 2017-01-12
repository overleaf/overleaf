define [
	"base"
], (App) ->
	App.directive "commentEntry", ($timeout) ->
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
			scope.state =
				animating: false

			scope.handleCommentReplyKeyPress = (ev) ->
				if ev.keyCode == 13 and !ev.shiftKey and !ev.ctrlKey and !ev.metaKey
					ev.preventDefault()
					ev.target.blur()
					scope.onReply()
			
			scope.animateAndCallOnResolve = () ->
				scope.state.animating = true
				element.find(".rp-entry").css("top", 0)
				$timeout((() -> scope.onResolve()), 200)
				return true