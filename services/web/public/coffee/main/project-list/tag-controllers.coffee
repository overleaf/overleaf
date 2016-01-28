define [
	"base"
], (App) ->

	App.controller "TagListController", ($scope, $modal) ->
		$scope.filterProjects = (filter = "all") ->
			$scope._clearTags()
			$scope.setFilter(filter)

		$scope._clearTags = () ->
			for tag in $scope.tags
				tag.selected = false
			
		$scope.selectTag = (tag) ->
			$scope._clearTags()
			tag.selected = true
			$scope.setFilter("tag")
		
		$scope.deleteTag = (tag) ->
			modalInstance = $modal.open(
				templateUrl: "deleteTagModalTemplate"
				controller: "DeleteTagModalController"
				resolve:
					tag: () -> tag
			)
			modalInstance.result.then () ->
				$scope.tags = $scope.tags.filter (t) -> t != tag

	App.controller "TagDropdownItemController", ($scope) ->
		$scope.recalculateProjectsInTag = () ->
			$scope.areSelectedProjectsInTag = false
			for project_id in $scope.getSelectedProjectIds()
				if project_id in $scope.tag.project_ids
					$scope.areSelectedProjectsInTag = true
				else
					partialSelection = true

			if $scope.areSelectedProjectsInTag and partialSelection
				$scope.areSelectedProjectsInTag = "partial"

		$scope.addOrRemoveProjectsFromTag = () ->
			if $scope.areSelectedProjectsInTag == true
				$scope.removeSelectedProjectsFromTag($scope.tag)
				$scope.areSelectedProjectsInTag = false
			else if $scope.areSelectedProjectsInTag == false or $scope.areSelectedProjectsInTag == "partial"
				$scope.addSelectedProjectsToTag($scope.tag)
				$scope.areSelectedProjectsInTag = true

		$scope.$watch "selectedProjects", () ->
			$scope.recalculateProjectsInTag()
		$scope.recalculateProjectsInTag()
