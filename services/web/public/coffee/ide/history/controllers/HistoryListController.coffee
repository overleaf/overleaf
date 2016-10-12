define [
	"base"
], (App) ->

	App.controller "HistoryPremiumPopup", ($scope, ide, sixpack)->
		$scope.$watch "ui.view", ->
			if $scope.ui.view == "history"
				if $scope.project?.features?.versioning
					$scope.versioningPopupType = "default"
				else if $scope.ui.view == "history"
					sixpack.participate 'history-discount', ['default', 'discount'], (chosenVariation, rawResponse)->
						$scope.versioningPopupType = chosenVariation

	App.controller "HistoryListController", ["$scope", "ide", ($scope, ide) ->
		$scope.hoveringOverListSelectors = false

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

		$scope.displayName = (user) ->
			full_name = "#{user.first_name} #{user.last_name}"
			fallback_name = "Unknown"
			if !user?
				fallback_name
			else if full_name != " "
				full_name
			else if user.email
				user.email
			else
				fallback_name
	]
