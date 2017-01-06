define [
	"base"
], (App) ->
	App.directive "resolvedCommentEntry", () ->
		restrict: "E"
		templateUrl: "resolvedCommentEntryTemplate"
		scope: 
			thread: "="
			doc: "="
			onReopen: "&"
			onDelete: "&"