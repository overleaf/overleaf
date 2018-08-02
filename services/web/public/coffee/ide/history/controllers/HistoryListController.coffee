define [
	"base",
	"ide/history/util/displayNameForUser"
], (App, displayNameForUser) ->

	App.controller "HistoryListController", ["$scope", "$modal", "ide", ($scope, $modal, ide) ->
		$scope.hoveringOverListSelectors = false

		projectUsers = $scope.project.members.concat $scope.project.owner
		console.log projectUsers
		_getUserById = (id) ->
			_.find projectUsers, (user) ->
				curUserId = user?._id or user?.id
				curUserId == id

		$scope.getDisplayNameById = (id) ->
			displayNameForUser(_getUserById(id))

		$scope.deleteLabel = (labelDetails) ->
			$modal.open(
				templateUrl: "historyV2DeleteLabelModalTemplate"
				controller: "HistoryV2DeleteLabelModalController"
				resolve:
					labelDetails: () -> labelDetails
			)

		$scope.loadMore = () =>
			ide.historyManager.fetchNextBatchOfUpdates()

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

	App.controller "HistoryListItemController", ["$scope", "event_tracking", ($scope, event_tracking) ->
		$scope.$watch "update.selectedFrom", (selectedFrom, oldSelectedFrom) ->
			if selectedFrom
				for update in $scope.history.updates
					update.selectedFrom = false unless update == $scope.update
				$scope.recalculateSelectedUpdates()		

		$scope.$watch "update.selectedTo", (selectedTo, oldSelectedTo) ->
			if selectedTo
				for update in $scope.history.updates
					update.selectedTo = false unless update == $scope.update
				$scope.recalculateSelectedUpdates()

		$scope.select = () ->
			event_tracking.sendMB "history-view-change"
			$scope.update.selectedTo = true
			$scope.update.selectedFrom = true

		$scope.mouseOverSelectedFrom = () ->
			$scope.history.hoveringOverListSelectors = true
			$scope.update.hoverSelectedFrom = true
			$scope.recalculateHoveredUpdates()

		$scope.mouseOutSelectedFrom = () ->
			$scope.history.hoveringOverListSelectors = false
			$scope.resetHoverState()

		$scope.mouseOverSelectedTo = () ->
			$scope.history.hoveringOverListSelectors = true
			$scope.update.hoverSelectedTo = true
			$scope.recalculateHoveredUpdates()

		$scope.mouseOutSelectedTo = () ->
			$scope.history.hoveringOverListSelectors = false
			$scope.resetHoverState()

		$scope.displayName = displayNameForUser
	]
