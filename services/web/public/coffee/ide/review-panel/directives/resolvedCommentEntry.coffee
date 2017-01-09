define [
	"base"
], (App) ->
	App.directive "resolvedCommentEntry", () ->
		restrict: "E"
		templateUrl: "resolvedCommentEntryTemplate"
		scope: 
			threadId: "="
			thread: "="
			doc: "="
			onUnresolve: "&"