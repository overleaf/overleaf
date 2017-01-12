define [
	"base"
], (App) ->
	App.directive "changeEntry", () ->
		restrict: "E"
		templateUrl: "changeEntryTemplate"
		scope: 
			entry: "="
			user: "="
			permissions: "="
			onAccept: "&"
			onReject: "&"
			onIndicatorClick: "&"
		