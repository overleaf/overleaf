define [
	"base"
], (App) ->
	App.directive "changeEntry", () ->
		restrict: "E"
		templateUrl: "changeEntryTemplate"
		scope: 
			entry: "="
			user: "="
			onAccept: "&"
			onReject: "&"
			onIndicatorClick: "&"
		