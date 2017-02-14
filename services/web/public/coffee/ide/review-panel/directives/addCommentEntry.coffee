define [
	"base"
], (App) ->
	App.directive "addCommentEntry", () ->
		restrict: "E"
		templateUrl: "addCommentEntryTemplate"
		scope: 
			onStartNew: "&"
			onSubmit: "&"
			onCancel: "&"
			onIndicatorClick: "&"
			layoutToLeft: "="
		link: (scope, element, attrs) ->
			scope.state =
				isAdding: false
				content: ""

			scope.startNewComment = () ->
				scope.state.isAdding = true
				scope.onStartNew()
				setTimeout () ->
					scope.$broadcast "comment:new:open"

			scope.cancelNewComment = () ->
				scope.state.isAdding = false
				scope.onCancel()

			scope.handleCommentKeyPress = (ev) ->
				if ev.keyCode == 13 and !ev.shiftKey and !ev.ctrlKey and !ev.metaKey
					ev.preventDefault()
					if scope.state.content.length > 0 
						scope.submitNewComment()

			scope.submitNewComment = () ->
				scope.onSubmit { content: scope.state.content }
				scope.state.isAdding = false
				scope.state.content = ""
