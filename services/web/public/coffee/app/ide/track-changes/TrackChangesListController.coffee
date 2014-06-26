define [
	"base"
], (App) ->
	App.controller "TrackChangesListController", ["$scope", ($scope) ->
		$scope.recalculateSelectedUpdates = () ->
			inSelection = false
			for update in $scope.trackChanges.updates
				if update.selectedTo
					inSelection = true
				update.inSelection = inSelection
				if update.selectedFrom
					inSelection = false
	]

	App.controller "TrackChangesListItemController", ["$scope", ($scope) ->
		$scope.$watch "update.selectedFrom", (selectedFrom) ->
			if selectedFrom? 
				if selectedFrom
					for update in $scope.trackChanges.updates
						update.selectedFrom = false unless update == $scope.update
				$scope.recalculateSelectedUpdates()		

		$scope.$watch "update.selectedTo", (selectedTo) ->
			if selectedTo?
				if selectedTo
					for update in $scope.trackChanges.updates
						update.selectedTo = false unless update == $scope.update
				$scope.recalculateSelectedUpdates()

		$scope.select = () ->
			$scope.update.selectedTo = true
			$scope.update.selectedFrom = true

	]