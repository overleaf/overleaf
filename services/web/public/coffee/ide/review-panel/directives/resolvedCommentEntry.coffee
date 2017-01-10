define [
	"base"
], (App) ->
	App.directive "resolvedCommentEntry", () ->
		restrict: "E"
		templateUrl: "resolvedCommentEntryTemplate"
		scope:
			entryId: "="
			threadId: "="
			thread: "="
			doc: "="
			onUnresolve: "&"
			onDelete: "&"