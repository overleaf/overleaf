window.ProjectPageApp = angular.module("ProjectPageApp", [])

ProjectPageApp.filter "formatDate", () ->
	(date, format = "Do MMM YYYY, h:mm a") ->
		moment(date).format(format)

ProjectPageApp.controller "ProjectPageController", ($scope) ->
	$scope.projects = window.data.projects
	$scope.tags = window.data.tags

ProjectPageApp.controller "ProjectListController", ($scope) ->
	$scope.allSelected = false
	$scope.visibleProjects = $scope.projects

	# Any individual changes to the selection buttons invalidates
	# our 'select all'
	$scope.$on "selected:on-change", (e) ->
		$scope.allSelected = false
		$scope.$broadcast "selection:change"

	# Selecting or deselecting all should apply to all projects
	$scope.onSelectAllChange = () ->
		for project in $scope.visibleProjects
			project.selected = $scope.allSelected
		$scope.$broadcast "selection:change"

	$scope.clearSelections = () ->
		for project in $scope.projects
			project.selected = false
		$scope.allSelected = false
		$scope.$broadcast "selection:change"

	$scope.getSelectedProjects = () ->
		$scope.projects.filter (project) -> project.selected

	$scope.getSelectedProjectIds = () ->
		$scope.getSelectedProjects().map (project) -> project._id

	$scope.$watch "searchText", (value) ->
		$scope.updateVisibleProjects()

	$scope.updateVisibleProjects = () ->
		$scope.visibleProjects = []
		for project in $scope.projects
			visible = true
			if $scope.searchText? and $scope.searchText != ""
				if !project.name.toLowerCase().match($scope.searchText.toLowerCase())
					visible = false
			if visible
				$scope.visibleProjects.push project
		$scope.clearSelections()

ProjectPageApp.controller "ProjectController", ($scope) ->
	$scope.onSelectedChange = () ->
		$scope.$emit "selected:on-change"

ProjectPageApp.controller "TagController", ($scope) ->

ProjectPageApp.controller "TagDropdownController", ($scope) ->
	$scope.$on "selection:change", (e, newValue, oldValue) ->
		console.log "selected watch listen"
		$scope.recalculateProjectsInTag()

	$scope.recalculateProjectsInTag = () ->
		$scope.areSelectedProjectsInTag = false
		for project_id in $scope.getSelectedProjectIds()
			if project_id in $scope.tag.project_ids
				$scope.areSelectedProjectsInTag = true

	$scope.addOrRemoveProjectsFromTag = () ->
		if $scope.areSelectedProjectsInTag
			$scope.removeSelectedProjectsFromTag()
		else
			$scope.addSelectedProjectsToTag()

	$scope.removeSelectedProjectsFromTag = () ->
		selected_project_ids = $scope.getSelectedProjectIds()
		remaining_project_ids = []
		for project_id in $scope.tag.project_ids
			if project_id not in selected_project_ids
				remaining_project_ids.push project_id
		$scope.tag.project_ids = remaining_project_ids
		$scope.areSelectedProjectsInTag = false

	$scope.addSelectedProjectsToTag = () ->
		for project_id in $scope.getSelectedProjectIds()
			unless project_id in $scope.tag.project_ids
				$scope.tag.project_ids.push project_id
		$scope.areSelectedProjectsInTag = true
