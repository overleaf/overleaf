define [
	"base"
	"../libs/fineuploader"
], (App) ->
	App.directive 'ngEnter', () ->
		return (scope, element, attrs) ->
			element.bind "keydown keypress", (event) ->
				if event.which == 13
					scope.$apply () ->
						scope.$eval(attrs.ngEnter, event: event)
					event.preventDefault()

	App.directive 'ngFocusOn', ($timeout) ->
		return {
			restrict: 'AC'
			link: (scope, element, attrs) ->
				scope.$on attrs.ngFocusOn, () ->
					element.focus()
		}

	App.filter "formatDate", () ->
		(date, format = "Do MMM YYYY, h:mm a") ->
			moment(date).format(format)

	App.controller "ProjectPageController", ($scope, $modal, $http, $q) ->
		$scope.projects = window.data.projects
		$scope.visibleProjects = $scope.projects
		$scope.tags = window.data.tags
		$scope.allSelected = false
		$scope.selectedProjects = []
		$scope.filter = "all"

		# Allow tags to be accessed on projects as well
		projectsById = {}
		for project in $scope.projects
			projectsById[project.id] = project

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

		$scope.setFilter = (filter) ->
			$scope.filter = filter
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
			$scope.selectedProjects.map (project) -> project.id

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
				if $scope.filter == "tag" and selectedTag? and project.id not in selectedTag.project_ids
					visible = false

				# Hide projects we own if we only want to see shared projects
				if $scope.filter == "shared" and project.accessLevel == "owner"
					visible = false

				# Hide projects we don't own if we only want to see owned projects
				if $scope.filter == "owned" and project.accessLevel != "owner"
					visible = false

				if $scope.filter == "archived"
					# Only show archived projects
					if !project.archived
						visible = false
				else
					# Only show non-archived projects
					if project.archived
						visible = false

				if visible
					$scope.visibleProjects.push project
				else
					# We don't want hidden selections
					project.selected = false
			$scope.updateSelectedProjects()

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
			return removed_project_ids

		$scope._removeProjectFromList = (project) ->
			index = $scope.projects.indexOf(project)
			if index > -1
				$scope.projects.splice(index, 1)

		$scope.removeSelectedProjectsFromTag = (tag) ->
			tag.showWhenEmpty = true

			selected_project_ids = $scope.getSelectedProjectIds()
			selected_projects = $scope.getSelectedProjects()

			removed_project_ids = $scope._removeProjectIdsFromTagArray(tag, selected_project_ids)

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
				unless tag in project.tags
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
				showWhenEmpty: true
			}

		$scope.openNewTagModal = (e) ->
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
			$http.post "/project/#{project.id}/rename", {
				newProjectName: newName
				_csrf: window.csrfToken
			}

		$scope.openRenameProjectModal = () ->
			project = $scope.getFirstSelectedProject()
			return if !project? or project.accessLevel != "owner"

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

		$scope.cloneProject = (project, cloneName) ->
			deferred = $q.defer()

			$http
				.post("/project/#{project.id}/clone", {
					_csrf: window.csrfToken
					projectName: cloneName
				})
				.success((data, status, headers, config) ->
					$scope.projects.push {
						name: cloneName
						id: data.project_id
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

		$scope.openCloneProjectModal = () ->
			project = $scope.getFirstSelectedProject()
			return if !project?

			modalInstance = $modal.open(
				templateUrl: "cloneProjectModalTemplate"
				controller: "CloneProjectModalController"
				resolve:
					project: () -> project
				scope: $scope
			)

		$scope.openArchiveProjectsModal = () ->
			modalInstance = $modal.open(
				templateUrl: "deleteProjectsModalTemplate"
				controller: "DeleteProjectsModalController"
				resolve:
					projects: () -> $scope.getSelectedProjects()
			)

			modalInstance.result.then () ->
				$scope.archiveOrLeaveSelectedProjects()

		$scope.archiveOrLeaveSelectedProjects = () ->
			selected_projects = $scope.getSelectedProjects()
			selected_project_ids = $scope.getSelectedProjectIds()

			# Remove project from any tags
			for tag in $scope.tags
				$scope._removeProjectIdsFromTagArray(tag, selected_project_ids)

			for project in selected_projects
				if project.accessLevel == "owner"
					project.archived = true
					$http {
						method: "DELETE"
						url: "/project/#{project.id}"
						headers:
							"X-CSRF-Token": window.csrfToken
					}
				else
					$scope._removeProjectFromList project

					$http {
						method: "POST"
						url: "/project/#{project.id}/leave"
						headers:
							"X-CSRF-Token": window.csrfToken
					}

			$scope.updateVisibleProjects()


		$scope.openDeleteProjectsModal = () ->
			modalInstance = $modal.open(
				templateUrl: "deleteProjectsModalTemplate"
				controller: "DeleteProjectsModalController"
				resolve:
					projects: () -> $scope.getSelectedProjects()
			)

			modalInstance.result.then () ->
				$scope.deleteSelectedProjects()

		$scope.deleteSelectedProjects = () ->
			selected_projects = $scope.getSelectedProjects()
			selected_project_ids = $scope.getSelectedProjectIds()

			# Remove projects from array
			for project in selected_projects
				$scope._removeProjectFromList project

			# Remove project from any tags
			for tag in $scope.tags
				$scope._removeProjectIdsFromTagArray(tag, selected_project_ids)

			for project_id in selected_project_ids
				$http {
					method: "DELETE"
					url: "/project/#{project_id}?forever=true"
					headers:
						"X-CSRF-Token": window.csrfToken
				}

			$scope.updateVisibleProjects()

		$scope.restoreSelectedProjects = () ->
			selected_projects = $scope.getSelectedProjects()
			selected_project_ids = $scope.getSelectedProjectIds()

			for project in selected_projects
				project.archived = false

			for project_id in selected_project_ids
				$http {
					method: "POST"
					url: "/project/#{project_id}/restore"
					headers:
						"X-CSRF-Token": window.csrfToken
				}

			$scope.updateVisibleProjects()

		$scope.openUploadProjectModal = () ->
			modalInstance = $modal.open(
				templateUrl: "uploadProjectModalTemplate"
				controller: "UploadProjectModalController"
			)

	App.controller "ProjectListItemController", ($scope) ->
		$scope.onSelectedChange = () ->
			$scope.$emit "selected:on-change"

		$scope.ownerName = () ->
			if $scope.project.accessLevel == "owner"
				return "You"
			else if $scope.project.owner?
				return "#{$scope.project.owner.first_name} #{$scope.project.owner.last_name}"
			else
				return "?"

	App.controller "TagListController", ($scope) ->
		$scope.filterProjects = (filter = "all") ->
			$scope._clearTags()
			$scope.setFilter(filter)

		$scope._clearTags = () ->
			for tag in $scope.tags
				tag.selected = false

		$scope.nonEmpty = (tag) ->
			# The showWhenEmpty property will be set on any tag which we have
			# modified during this session. Otherwise, tags which are empty
			# when loading the page are not shown.
			tag.project_ids.length > 0 or !!tag.showWhenEmpty

	App.controller "TagListItemController", ($scope) ->
		$scope.selectTag = () ->
			$scope._clearTags()
			$scope.tag.selected = true
			$scope.setFilter("tag")

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

		$scope.addOrRemoveProjectsFromTag = (e) ->
			if $scope.areSelectedProjectsInTag == true
				$scope.removeSelectedProjectsFromTag($scope.tag)
				$scope.areSelectedProjectsInTag = false
			else if $scope.areSelectedProjectsInTag == false or $scope.areSelectedProjectsInTag == "partial"
				$scope.addSelectedProjectsToTag($scope.tag)
				$scope.areSelectedProjectsInTag = true

		$scope.$on "selection:change", (e, newValue, oldValue) ->
			$scope.recalculateProjectsInTag()
		$scope.recalculateProjectsInTag()

	App.controller 'NewTagModalController', ($scope, $modalInstance, $timeout) ->
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

	App.controller 'RenameProjectModalController', ($scope, $modalInstance, $timeout, projectName) ->
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

	App.controller 'CloneProjectModalController', ($scope, $modalInstance, $timeout, project) ->
		$scope.inputs = 
			projectName: project.name + " (Copy)"
		$scope.state =
			inflight: false

		$modalInstance.opened.then () ->
			$timeout () ->
				$scope.$broadcast "open"
			, 700

		$scope.clone = () ->
			$scope.state.inflight = true
			$scope
				.cloneProject(project, $scope.inputs.projectName)
				.then (project_id) ->
					$scope.state.inflight = false
					$modalInstance.close(project_id)

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')

	App.controller 'NewProjectModalController', ($scope, $modalInstance, $timeout, template) ->
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

	App.controller 'DeleteProjectsModalController', ($scope, $modalInstance, $timeout, projects) ->
		$scope.projectsToDelete = projects.filter (project) -> project.accessLevel == "owner"
		$scope.projectsToLeave = projects.filter (project) -> project.accessLevel != "owner"

		if $scope.projectsToLeave.length > 0 and $scope.projectsToDelete.length > 0
			$scope.action = "Delete & Leave"
		else if $scope.projectsToLeave.length == 0 and $scope.projectsToDelete.length > 0
			$scope.action = "Delete"
		else
			$scope.action = "Leave"

		$scope.delete = () ->
			$modalInstance.close()

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')

	App.directive 'ngFineUpload', ($timeout) ->
		return (scope, element, attrs) ->
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

	App.controller 'UploadProjectModalController', ($scope, $modalInstance, $timeout) ->
		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')
