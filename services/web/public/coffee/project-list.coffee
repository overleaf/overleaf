window.ProjectPageApp = angular.module("ProjectPageApp", ['ui.bootstrap'])

$ () ->
	$(".js-tags-dropdown-menu input, .js-tags-dropdown-menu a").click (e) ->
		e.stopPropagation()

ProjectPageApp.directive 'ngEnter', () ->
	return (scope, element, attrs) ->
		element.bind "keydown keypress", (event) ->
			if event.which == 13
				scope.$apply () ->
					scope.$eval(attrs.ngEnter, event: event)
				event.preventDefault()

ProjectPageApp.directive 'ngFocusOn', ($timeout) ->
	return {
		restrict: 'AC'
		link: (scope, element, attrs) ->
			scope.$on attrs.ngFocusOn, () ->
				element.focus()
	}

ProjectPageApp.filter "formatDate", () ->
	(date, format = "Do MMM YYYY, h:mm a") ->
		moment(date).format(format)

ProjectPageApp.controller "ProjectPageController", ($scope, $modal, $http) ->
	$scope.projects = window.data.projects
	$scope.visibleProjects = $scope.projects
	$scope.tags = window.data.tags
	$scope.allSelected = false
	$scope.selectedProjects = []

	# Allow tags to be accessed on projects as well
	projectsById = {}
	for project in $scope.projects
		projectsById[project._id] = project

	for tag in $scope.tags
		for project_id in tag.project_ids or []
			project = projectsById[project_id]
			if project?
				project.tags ||= []
				project.tags.push tag

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

	$scope.updateSelectedProjects = () ->
		$scope.selectedProjects = $scope.projects.filter (project) -> project.selected

	$scope.getSelectedProjects = () ->
		$scope.selectedProjects

	$scope.getSelectedProjectIds = () ->
		$scope.selectedProjects.map (project) -> project._id

	$scope.$on "selection:change", () ->
		$scope.updateSelectedProjects()

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
			else
				# We don't want hidden selections
				project.selected = false

	$scope.getSelectedTag = () ->
		for tag in $scope.tags
			return tag if tag.selected
		return null

	$scope.removeSelectedProjectsFromTag = (tag) ->
		selected_project_ids = $scope.getSelectedProjectIds()
		selected_projects = $scope.getSelectedProjects()

		# Remove project_id from tag.project_ids
		remaining_project_ids = []
		removed_project_ids = []
		for project_id in tag.project_ids
			if project_id not in selected_project_ids
				remaining_project_ids.push project_id
			else
				removed_project_ids.push project_id
		tag.project_ids = remaining_project_ids

		# Remove tag from project.tags
		remaining_tags = []
		for project in selected_projects
			project.tags ||= []
			index = project.tags.indexOf tag
			if index > -1
				project.tags.splice(index, 1)

		for project_id in removed_project_ids
			$http.post "/project/#{project_id}/tag", {
				deletedTag: tag.name
				_csrf: window.csrfToken
			}

		# If we're filtering by this tag then we need to remove
		# the projects from view
		$scope.updateVisibleProjects()

	$scope.addSelectedProjectsToTag = (tag) ->
		selected_projects = $scope.getSelectedProjects()

		# Add project_ids into tag.project_ids
		added_project_ids = []
		for project_id in $scope.getSelectedProjectIds()
			unless project_id in tag.project_ids
				tag.project_ids.push project_id
				added_project_ids.push project_id

		# Add tag into each project.tags
		for project in selected_projects
			project.tags ||= []
			project.tags.push tag

		for project_id in added_project_ids
			# TODO Factor this out into another provider?
			$http.post "/project/#{project_id}/tag", {
				tag: tag.name
				_csrf: window.csrfToken
			}

	$scope.createTag = (name) ->
		$scope.tags.push {
			name: name
			project_ids: []
		}

	$scope.openNewTagModal = () ->
		modalInstance = $modal.open(
			templateUrl: "newTagModalTemplate"
			controller: "NewTagModalController"
		)

		modalInstance.result.then(
			(newTagName) ->
				$scope.createTag(newTagName)
		)

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
		$scope.recalculateProjectsInTag()

	$scope.recalculateProjectsInTag = () ->
		$scope.areSelectedProjectsInTag = false
		for project_id in $scope.getSelectedProjectIds()
			if project_id in $scope.tag.project_ids
				$scope.areSelectedProjectsInTag = true

	$scope.addOrRemoveProjectsFromTag = () ->
		if $scope.areSelectedProjectsInTag
			$scope.removeSelectedProjectsFromTag($scope.tag)
			$scope.areSelectedProjectsInTag = false
		else
			$scope.addSelectedProjectsToTag($scope.tag)
			$scope.areSelectedProjectsInTag = true

ProjectPageApp.controller 'NewTagModalController', ($scope, $modalInstance, $timeout) ->
	$scope.inputs = 
		newTagName: "original"

	$modalInstance.opened.then () ->
		$timeout () ->
			$scope.$broadcast "open"
		, 700

	$scope.create = () ->
		console.log $scope.inputs.newTagName
		$modalInstance.close($scope.inputs.newTagName)

	$scope.cancel = () ->
		$modalInstance.dismiss('cancel')
