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
		link: (scope, element, attrs) ->
			scope.state =
				isAdding: false
				content: ""

			scope.startNewComment = () ->
				scope.state.isAdding = true
				scope.onStartNew()

			scope.cancelNewComment = () ->
				scope.state.isAdding = false
				scope.onCancel()

			scope.handleCommentKeyPress = (ev) ->
				if ev.keyCode == 13 and !ev.shiftKey and !ev.ctrlKey and !ev.metaKey
					ev.preventDefault()
					ev.target.blur()
					scope.submitNewComment()

			scope.submitNewComment = () ->
				console.log scope.state.content
				scope.onSubmit { content: scope.state.content }
				scope.state.isAdding = false
				scope.state.content = ""