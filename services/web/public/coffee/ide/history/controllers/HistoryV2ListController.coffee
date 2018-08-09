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
			$scope.recalculateSelectedUpdates()

		$scope.handleLabelSelect = (label) ->
			ide.historyManager.selectLabel(label)
			$scope.recalculateSelectedUpdates()
			
		$scope.handleLabelDelete = (labelDetails) ->
			$modal.open(
				templateUrl: "historyV2DeleteLabelModalTemplate"
				controller: "HistoryV2DeleteLabelModalController"
				resolve:
					labelDetails: () -> labelDetails
			)

		$scope.recalculateSelectedUpdates = () ->
			beforeSelection = true
			afterSelection = false
			$scope.history.selection.updates = []
			for update in $scope.history.updates
				if update.selectedTo
					inSelection = true
					beforeSelection = false

				update.beforeSelection = beforeSelection
				update.inSelection = inSelection
				update.afterSelection = afterSelection

				if inSelection
					$scope.history.selection.updates.push update

				if update.selectedFrom
					inSelection = false
					afterSelection = true

		$scope.recalculateHoveredUpdates = () ->
			hoverSelectedFrom = false
			hoverSelectedTo = false
			for update in $scope.history.updates
				# Figure out whether the to or from selector is hovered over
				if update.hoverSelectedFrom
					hoverSelectedFrom = true
				if update.hoverSelectedTo
					hoverSelectedTo = true

			if hoverSelectedFrom
				# We want to 'hover select' everything between hoverSelectedFrom and selectedTo
				inHoverSelection = false
				for update in $scope.history.updates
					if update.selectedTo
						update.hoverSelectedTo = true
						inHoverSelection = true
					update.inHoverSelection = inHoverSelection
					if update.hoverSelectedFrom
						inHoverSelection = false
			if hoverSelectedTo
				# We want to 'hover select' everything between hoverSelectedTo and selectedFrom
				inHoverSelection = false
				for update in $scope.history.updates
					if update.hoverSelectedTo
						inHoverSelection = true
					update.inHoverSelection = inHoverSelection
					if update.selectedFrom
						update.hoverSelectedFrom = true
						inHoverSelection = false

		$scope.resetHoverState = () ->
			for update in $scope.history.updates
				delete update.hoverSelectedFrom
				delete update.hoverSelectedTo
				delete update.inHoverSelection

		$scope.$watch "history.updates.length", () ->
			$scope.recalculateSelectedUpdates()
	]