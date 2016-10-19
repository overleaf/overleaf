define [
	"base"
], (App) ->

	App.controller "ProjectPageController", ($scope, $modal, $q, $window, queuedHttp, event_tracking, $timeout) ->
		$scope.projects = window.data.projects
		$scope.tags = window.data.tags
		$scope.notifications = window.data.notifications
		$scope.allSelected = false
		$scope.selectedProjects = []
		$scope.filter = "all"
		$scope.predicate = "lastUpdated"
		$scope.reverse = true
		$scope.searchText = 
			value : ""

		if $scope.projects.length == 0
			$timeout () ->
				recalculateProjectListHeight()
			, 10

		recalculateProjectListHeight = () ->
			topOffset = $(".project-list-card")?.offset()?.top
			bottomOffset = $("footer").outerHeight() + 25
			sideBarHeight = $("aside").height() - 56
			# When footer is visible and page doesn't need to scroll we just make it
			# span between header and footer
			height = $window.innerHeight - topOffset - bottomOffset
			
			# When page is small enough that this pushes the project list smaller than
			# the side bar, then the window going to have to scroll to take into account the
			# footer. So we now start to track to the bottom of the window, with a 25px padding
			# since the footer is hidden below the fold. Don't ever get bigger than the sidebar
			# though since that's what triggered this happening in the first place.
			if height < sideBarHeight
				height = Math.min(sideBarHeight, $window.innerHeight - topOffset - 25)
			$scope.projectListHeight = height
		

		angular.element($window).bind "resize", () ->
			recalculateProjectListHeight()
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

		$scope.searchProjects = ->
			event_tracking.send 'project-list-page-interaction', 'project-search', 'keydown'
			$scope.updateVisibleProjects()

		$scope.clearSearchText = () ->
			$scope.searchText.value = ""
			$scope.filter = "all"
			$scope.$emit "search:clear"
			$scope.updateVisibleProjects()

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
				if $scope.searchText.value? and $scope.searchText.value != ""
					if !project.name.toLowerCase().match($scope.searchText.value.toLowerCase())
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
				queuedHttp({
					method: "DELETE"
					url: "/tag/#{tag._id}/project/#{project_id}"
					headers:
						"X-CSRF-Token": window.csrfToken
				})

			# If we're filtering by this tag then we need to remove
			# the projects from view
			$scope.updateVisibleProjects()

		$scope.addSelectedProjectsToTag = (tag) ->
			selected_projects = $scope.getSelectedProjects()
			event_tracking.send 'project-list-page-interaction', 'project action', 'addSelectedProjectsToTag'

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
				queuedHttp.post "/tag/#{tag._id}/project/#{project_id}", {
					_csrf: window.csrfToken
				}

		$scope.createTag = (name) ->
			return tag

		$scope.openNewTagModal = (e) ->
			modalInstance = $modal.open(
				templateUrl: "newTagModalTemplate"
				controller: "NewTagModalController"
			)

			modalInstance.result.then(
				(tag) ->
					$scope.tags.push tag
					$scope.addSelectedProjectsToTag(tag)
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
			event_tracking.send 'project-list-page-interaction', 'new-project', template
			modalInstance = $modal.open(
				templateUrl: "newProjectModalTemplate"
				controller: "NewProjectModalController"
				resolve:
					template: () -> template
				scope: $scope
			)

			modalInstance.result.then (project_id) ->
				window.location = "/project/#{project_id}"

		MAX_PROJECT_NAME_LENGTH = 150
		$scope.renameProject = (project, newName) ->
			if !newName? or newName.length == 0 or newName.length > MAX_PROJECT_NAME_LENGTH
				return
			project.name = newName
			queuedHttp.post "/project/#{project.id}/rename", {
				newProjectName: project.name
				_csrf: window.csrfToken
			}

		$scope.openRenameProjectModal = () ->
			project = $scope.getFirstSelectedProject()
			return if !project? or project.accessLevel != "owner"
			event_tracking.send 'project-list-page-interaction', 'project action', 'Rename'
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
			event_tracking.send 'project-list-page-interaction', 'project action', 'Clone'
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
			event_tracking.send 'project-list-page-interaction', 'project action', 'Delete'
			modalInstance.result.then () ->
				$scope.archiveOrLeaveSelectedProjects()

		$scope.archiveOrLeaveSelectedProjects = () ->
			selected_projects = $scope.getSelectedProjects()
			selected_project_ids = $scope.getSelectedProjectIds()

			# Remove project from any tags
			for tag in $scope.tags
				$scope._removeProjectIdsFromTagArray(tag, selected_project_ids)

			for project in selected_projects
				project.tags = []
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
			event_tracking.send 'project-list-page-interaction', 'project action', 'Download Zip'
			if selected_project_ids.length > 1
				path = "/project/download/zip?project_ids=#{selected_project_ids.join(',')}"
			else
				path = "/project/#{selected_project_ids[0]}/download/zip"

			window.location = path
			
		$scope.updateVisibleProjects()

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