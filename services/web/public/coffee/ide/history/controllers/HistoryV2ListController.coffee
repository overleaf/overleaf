define [
	"base",
	"ide/history/util/displayNameForUser"
], (App, displayNameForUser) ->

	App.controller "HistoryV2ListController", ["$scope", "$modal", "ide", ($scope, $modal, ide) ->
		$scope.hoveringOverListSelectors = false
		$scope.listConfig =
			showOnlyLabelled: false
		$scope.projectUsers = $scope.project.members.concat $scope.project.owner
		
		$scope.loadMore = () =>
			ide.historyManager.fetchNextBatchOfUpdates()

		$scope.handleEntrySelect = (entry) ->
			ide.historyManager.selectUpdate(entry)

		$scope.handleLabelSelect = (label) ->
			ide.historyManager.selectLabel(label)
			
		$scope.handleLabelDelete = (labelDetails) ->
			$modal.open(
				templateUrl: "historyV2DeleteLabelModalTemplate"
				controller: "HistoryV2DeleteLabelModalController"
				resolve:
					labelDetails: () -> labelDetails
			)
	]