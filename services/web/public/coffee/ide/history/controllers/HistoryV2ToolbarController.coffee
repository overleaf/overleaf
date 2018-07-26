define [
	"base",
], (App) ->
	App.controller "HistoryV2ToolbarController", ["$scope", "$modal", "ide", ($scope, $modal, ide) ->
		$scope.showAddLabelDialog = () ->
			$modal.open(
				templateUrl: "historyV2AddLabelModalTemplate"
				controller: "HistoryV2AddLabelModalController"
			)
	]