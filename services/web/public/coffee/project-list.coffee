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

ProjectPageApp.controller "ProjectPageController", ($scope, $modal, $http, $q) ->
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

	$scope.getFirstSelectedProject = () ->
		$scope.selectedProjects[0]

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

	$scope._removeProjectIdsFromTagArray = (tag, remove_project_ids) ->
		# Remove project_id from tag.project_ids
		remaining_project_ids = []
		removed_project_ids = []
		for project_id in tag.project_ids
			if project_id not in remove_project_ids
				remaining_project_ids.push project_id
			else
				removed_project_ids.push project_id
		tag.project_ids = remaining_project_ids

	$scope.removeSelectedProjectsFromTag = (tag) ->
		selected_project_ids = $scope.getSelectedProjectIds()
		selected_projects = $scope.getSelectedProjects()

		$scope._removeProjectIdsFromTagArray(tag, selected_project_ids)

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

	$scope.createProject = (name, template = "none") ->
		deferred = $q.defer()

		$http
			.post("/project/new", {
				_csrf: window.csrfToken
				projectName: name
				template: template
			})
			.success((data, status, headers, config) ->
				$scope.projects.push {
					name: name
					_id: data.project_id
					accessLevel: "owner"
					# TODO: Check access level if correct after adding it in
					# to the rest of the app
				}
				$scope.updateVisibleProjects()
				deferred.resolve(data.project_id)
			)
			.error((data, status, headers, config) ->
				deferred.reject()
			)

		return deferred.promise

	$scope.openCreateProjectModal = (template = "none") ->
		modalInstance = $modal.open(
			templateUrl: "newProjectModalTemplate"
			controller: "NewProjectModalController"
			resolve:
				template: () -> template
			scope: $scope
		)

		modalInstance.result.then (project_id) ->
			window.location = "/project/#{project_id}"

	$scope.renameProject = (project, newName) ->
		project.name = newName
		$http.post "/project/#{project._id}/rename", {
			newProjectName: newName
			_csrf: window.csrfToken
		}

	$scope.openRenameProjectModal = () ->
		project = $scope.getFirstSelectedProject()
		return if !project?

		modalInstance = $modal.open(
			templateUrl: "renameProjectModalTemplate"
			controller: "RenameProjectModalController"
			resolve:
				projectName: () -> project.name
		)

		modalInstance.result.then(
			(newName) ->
				$scope.renameProject(project, newName)
		)

	$scope.deleteSelectedProjects = () ->
		selected_projects = $scope.getSelectedProjects()
		selected_project_ids = $scope.getSelectedProjectIds()

		# Remove projects from array
		for project in selected_projects
			index = $scope.projects.indexOf(project)
			if index > -1
				$scope.projects.splice(index, 1)

		# Remove project from any tags
		for tag in $scope.tags
			$scope._removeProjectIdsFromTagArray(tag, selected_project_ids)

		for project_id in selected_project_ids
			$http {
				method: "DELETE"
				url: "/project/#{project_id}"
				headers:
					"X-CSRF-Token": window.csrfToken
			}

		$scope.updateVisibleProjects()

	$scope.openUploadProjectModal = () ->
		modalInstance = $modal.open(
			templateUrl: "uploadProjectModalTemplate"
			controller: "UploadProjectModalController"
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
		newTagName: ""

	$modalInstance.opened.then () ->
		$timeout () ->
			$scope.$broadcast "open"
		, 700

	$scope.create = () ->
		$modalInstance.close($scope.inputs.newTagName)

	$scope.cancel = () ->
		$modalInstance.dismiss('cancel')

ProjectPageApp.controller 'RenameProjectModalController', ($scope, $modalInstance, $timeout, projectName) ->
	$scope.inputs = 
		projectName: projectName

	$modalInstance.opened.then () ->
		$timeout () ->
			$scope.$broadcast "open"
		, 700

	$scope.rename = () ->
		$modalInstance.close($scope.inputs.projectName)

	$scope.cancel = () ->
		$modalInstance.dismiss('cancel')

ProjectPageApp.controller 'NewProjectModalController', ($scope, $modalInstance, $timeout, template) ->
	$scope.inputs = 
		projectName: ""
	$scope.state =
		inflight: false

	$modalInstance.opened.then () ->
		$timeout () ->
			$scope.$broadcast "open"
		, 700

	$scope.create = () ->
		$scope.state.inflight = true
		$scope
			.createProject($scope.inputs.projectName, template)
			.then (project_id) ->
				$scope.state.inflight = false
				$modalInstance.close(project_id)

	$scope.cancel = () ->
		$modalInstance.dismiss('cancel')

ProjectPageApp.directive 'ngFineUpload', ($timeout) ->
	return (scope, element, attrs) ->
		console.log "Creating fine uploader"
		new qq.FineUploader
			element: element[0]
			multiple: false
			disabledCancelForFormUploads: true
			validation:
				allowedExtensions: ["zip"]
			request:
				endpoint: "/project/new/upload"
				forceMultipart: true
				params:
					_csrf: window.csrfToken
			callbacks:
				onComplete: (error, name, response)->
					if response.project_id?
						window.location = '/project/'+response.project_id
			text:
				waitingForResponse: "Creating project..."
				failUpload: "Upload failed. Is it a valid zip file?"
				uploadButton: "Select a .zip file"
			template: """
				<div class="qq-uploader">
					<div class="qq-upload-drop-area"><span>{dragZoneText}</span></div>
					<div class="qq-upload-button btn btn-primary btn-lg">
						<div>{uploadButtonText}</div>
					</div>
					<span class="or btn-lg"> or </span>
					<span class="drag-here btn-lg">drag a .zip file</span>
					<span class="qq-drop-processing"><span>{dropProcessingText}</span><span class="qq-drop-processing-spinner"></span></span>
					<ul class="qq-upload-list"></ul>
				</div>
			"""

ProjectPageApp.controller 'UploadProjectModalController', ($scope, $modalInstance, $timeout) ->
	$scope.cancel = () ->
		$modalInstance.dismiss('cancel')
