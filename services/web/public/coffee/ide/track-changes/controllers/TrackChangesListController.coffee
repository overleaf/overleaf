define [
	"base"
], (App) ->
	App.controller "TrackChangesListController", ["$scope", "ide", ($scope, ide) ->
		$scope.hoveringOverListSelectors = false

		$scope.loadMore = () =>
			ide.trackChangesManager.fetchNextBatchOfUpdates()

		$scope.recalculateSelectedUpdates = () ->
			beforeSelection = true
			afterSelection = false
			$scope.trackChanges.selection.updates = []
			for update in $scope.trackChanges.updates
				if update.selectedTo
					inSelection = true
					beforeSelection = false

				update.beforeSelection = beforeSelection
				update.inSelection = inSelection
				update.afterSelection = afterSelection

				if inSelection
					$scope.trackChanges.selection.updates.push update

				if update.selectedFrom
					inSelection = false
					afterSelection = true

		$scope.recalculateHoveredUpdates = () ->
			hoverSelectedFrom = false
			hoverSelectedTo = false
			for update in $scope.trackChanges.updates
				# Figure out whether the to or from selector is hovered over
				if update.hoverSelectedFrom
					hoverSelectedFrom = true
				if update.hoverSelectedTo
					hoverSelectedTo = true

			if hoverSelectedFrom
				# We want to 'hover select' everything between hoverSelectedFrom and selectedTo
				inHoverSelection = false
				for update in $scope.trackChanges.updates
					if update.selectedTo
						update.hoverSelectedTo = true
						inHoverSelection = true
					update.inHoverSelection = inHoverSelection
					if update.hoverSelectedFrom
						inHoverSelection = false
			if hoverSelectedTo
				# We want to 'hover select' everything between hoverSelectedTo and selectedFrom
				inHoverSelection = false
				for update in $scope.trackChanges.updates
					if update.hoverSelectedTo
						inHoverSelection = true
					update.inHoverSelection = inHoverSelection
					if update.selectedFrom
						update.hoverSelectedFrom = true
						inHoverSelection = false

		$scope.resetHoverState = () ->
			for update in $scope.trackChanges.updates
				delete update.hoverSelectedFrom
				delete update.hoverSelectedTo
				delete update.inHoverSelection

		$scope.$watch "trackChanges.updates.length", () ->
			$scope.recalculateSelectedUpdates()
	]

	App.controller "TrackChangesListItemController", ["$scope", ($scope) ->
		$scope.$watch "update.selectedFrom", (selectedFrom, oldSelectedFrom) ->
			if selectedFrom
				for update in $scope.trackChanges.updates
					update.selectedFrom = false unless update == $scope.update
				$scope.recalculateSelectedUpdates()		

		$scope.$watch "update.selectedTo", (selectedTo, oldSelectedTo) ->
			if selectedTo
				for update in $scope.trackChanges.updates
					update.selectedTo = false unless update == $scope.update
				$scope.recalculateSelectedUpdates()

		$scope.select = () ->
			$scope.update.selectedTo = true
			$scope.update.selectedFrom = true

		$scope.mouseOverSelectedFrom = () ->
			$scope.trackChanges.hoveringOverListSelectors = true
			$scope.update.hoverSelectedFrom = true
			$scope.recalculateHoveredUpdates()

		$scope.mouseOutSelectedFrom = () ->
			$scope.trackChanges.hoveringOverListSelectors = false
			$scope.resetHoverState()

		$scope.mouseOverSelectedTo = () ->
			$scope.trackChanges.hoveringOverListSelectors = true
			$scope.update.hoverSelectedTo = true
			$scope.recalculateHoveredUpdates()

		$scope.mouseOutSelectedTo = () ->
			$scope.trackChanges.hoveringOverListSelectors = false
			$scope.resetHoverState()

	]