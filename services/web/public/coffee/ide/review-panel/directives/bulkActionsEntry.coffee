define [
	"base"
], (App) ->
	App.directive "bulkActionsEntry", () ->
		restrict: "E"
		templateUrl: "bulkActionsEntryTemplate"
		scope: 
			onBulkAccept: "&"
			onBulkReject: "&"
			nEntries: "="
		link: (scope, element, attrs) ->
			scope.bulkAccept = () ->
				scope.onBulkAccept()
			scope.bulkReject = () ->
				scope.onBulkReject()