define [
	"base"
], (App) ->
	App.directive "changeEntry", () ->
		restrict: "E"
		templateUrl: "changeEntryTemplate"
		scope: 
			entry: "="
			author: "="
			onAccept: "&"
			onReject: "&"
		