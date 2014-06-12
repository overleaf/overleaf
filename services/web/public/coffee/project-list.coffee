window.ProjectPageApp = angular.module("ProjectPageApp", [])

ProjectPageApp.filter "formatDate", () ->
	(date, format = "Do MMM YYYY, h:mm a") ->
		moment(date).format(format)

ProjectPageApp.controller "ProjectPageController", ($scope) ->
	$scope.projects = window.data.projects
	$scope.visibleProjects = $scope.projects
	$scope.tags = window.data.tags
	$scope.allSelected = false

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

	$scope.$watch "searchText", (value) ->
		$scope.updateVisibleProjects()

	$scope.clearProjectSelections = () ->
		for project in $scope.projects
			project.selected = false
		$scope.allSelected = false
		$scope.$broadcast "selection:change"

	$scope.updateVisibleProjects = () ->
		$scope.visibleProjects = []
		selectedTag = $scope.getSelectedTag()
		for project in $scope.projects
			visible = true
			# Only show if it matches any search text
			if $scope.searchText? and $scope.searchText != ""
				if !project.name.toLowerCase().match($scope.searchText.toLowerCase())
					visible = false
			# Only show if it matches the selected tag
			if selectedTag? and project._id not in selectedTag.project_ids
				visible = false
			if visible
				$scope.visibleProjects.push project
		console.log "visible", $scope.visibleProjects
		$scope.clearProjectSelections()

	$scope.getSelectedProjects = () ->
		$scope.projects.filter (project) -> project.selected

	$scope.getSelectedProjectIds = () ->
		$scope.getSelectedProjects().map (project) -> project._id

	$scope.getSelectedTag = () ->
		for tag in $scope.tags
			return tag if tag.selected
		return null

ProjectPageApp.controller "ProjectListItemController", ($scope) ->
	$scope.onSelectedChange = () ->
		$scope.$emit "selected:on-change"

ProjectPageApp.controller "TagListController", ($scope) ->
	$scope.view = "all"

	$scope.selectAllProjects = () ->
		$scope._clearTags()
		$scope.setActiveItem("all")
		$scope.updateVisibleProjects()

	$scope._clearTags = () ->
		for tag in $scope.tags
			tag.selected = false

	$scope.setActiveItem = (view) ->
		$scope.view = view

ProjectPageApp.controller "TagListItemController", ($scope) ->
	$scope.selectTag = () ->
		$scope._clearTags()
		$scope.tag.selected = true
		$scope.setActiveItem("tag")
		$scope.updateVisibleProjects()

ProjectPageApp.controller "TagDropdownItemController", ($scope) ->
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
