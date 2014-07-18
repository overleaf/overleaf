define [
	"base"
], (App) ->
	App.factory "queuedHttp", ["$http", "$q", ($http, $q) ->
		pendingRequests = []
		inflight = false

		processPendingRequests = () ->
			return if inflight
			doRequest = pendingRequests.shift()
			if doRequest?
				inflight = true
				doRequest()
					.success () ->
						inflight = false
						processPendingRequests()
					.error () ->
						inflight = false
						processPendingRequests()

		queuedHttp = (args...) ->
			deferred = $q.defer()
			promise = deferred.promise

			# Adhere to the $http promise conventions
			promise.success = (callback) ->
				promise.then(callback)
				return promise

			promise.error = (callback) ->
				promise.catch(callback)
				return promise

			doRequest = () ->
				$http(args...)
					.success (successArgs...) ->
						deferred.resolve(successArgs...)
					.error (errorArgs...) ->
						deferred.reject(errorArgs...)

			pendingRequests.push doRequest
			processPendingRequests()

			return promise

		queuedHttp.post = (url, data) ->
			queuedHttp({method: "POST", url: url, data: data})

		return queuedHttp

	]

	App.controller "ProjectPageController", ($scope, $modal, $q, $window, queuedHttp) ->
		$scope.projects = window.data.projects
		$scope.visibleProjects = $scope.projects
		$scope.tags = window.data.tags
		$scope.allSelected = false
		$scope.selectedProjects = []
		$scope.filter = "all"
		$scope.predicate = "lastUpdated"
		$scope.reverse = false

		$scope.windowHeight = $window.innerHeight
		angular.element($window).bind "resize", () ->
			$scope.windowHeight = $window.innerHeight
			$scope.$apply()

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

		$scope.changePredicate = (newPredicate)->
			if $scope.predicate == newPredicate
				$scope.reverse = !$scope.reverse
			$scope.predicate = newPredicate

		$scope.getSortIconClass = (column)->
			if column == $scope.predicate and $scope.reverse
				return "fa-caret-down"
			else if column == $scope.predicate and !$scope.reverse
				return "fa-caret-up"
			else
				return ""

		$scope.clearSearchText = () ->
			$scope.searchText = ""
			$scope.$emit "search:clear"

		$scope.setFilter = (filter) ->
			$scope.filter = filter
			$scope.updateVisibleProjects()

		$scope.updateSelectedProjects = () ->
			$scope.selectedProjects = $scope.projects.filter (project) -> project.selected

		$scope.getSelectedProjects = () ->
			$scope.selectedProjects

		$scope.getSelectedProjectIds = () ->
			$scope.selectedProjects.map (project) -> project.id

		$scope.getFirstSelectedProject = () ->
			$scope.selectedProjects[0]

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
				queuedHttp.post "/project/#{project_id}/tag", {
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
				queuedHttp.post "/project/#{project_id}/tag", {
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

			queuedHttp
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
			queuedHttp.post "/project/#{project.id}/rename", {
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

			queuedHttp
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
					queuedHttp {
						method: "DELETE"
						url: "/project/#{project.id}"
						headers:
							"X-CSRF-Token": window.csrfToken
					}
				else
					$scope._removeProjectFromList project

					queuedHttp {
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
				queuedHttp {
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
				queuedHttp {
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

		$scope.downloadSelectedProjects = () ->
			selected_project_ids = $scope.getSelectedProjectIds()

			if selected_project_ids.length > 1
				path = "/project/download/zip?project_ids=#{selected_project_ids.join(',')}"
			else
				path = "/project/#{selected_project_ids[0]}/download/zip"

			window.location = path


	App.controller "ProjectListItemController", ($scope) ->
		$scope.ownerName = () ->
			if $scope.project.accessLevel == "owner"
				return "You"
			else if $scope.project.owner?
				return "#{$scope.project.owner.first_name} #{$scope.project.owner.last_name}"
			else
				return "?"

		$scope.$watch "project.selected", (value) ->
			if value?
				$scope.updateSelectedProjects()

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
			
		$scope.selectTag = (tag) ->
			$scope._clearTags()
			tag.selected = true
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

	App.controller 'NewTagModalController', ($scope, $modalInstance, $timeout) ->
		$scope.inputs = 
			newTagName: ""

		$modalInstance.opened.then () ->
			$timeout () ->
				$scope.$broadcast "open"
			, 200

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
			, 200

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
			, 200

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
			, 200

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


	App.controller 'UploadProjectModalController', ($scope, $modalInstance, $timeout) ->
		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')

		$scope.onComplete = (error, name, response) ->
			if response.project_id?
				window.location = '/project/' + response.project_id
