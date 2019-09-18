define(['base', 'main/project-list/services/project-list'], function(App) {
  App.controller('ProjectPageController', function(
    $scope,
    $modal,
    $window,
    queuedHttp,
    event_tracking, // eslint-disable-line camelcase
    $timeout,
    localStorage,
    ProjectListService
  ) {
    $scope.projects = window.data.projects
    $scope.tags = window.data.tags
    $scope.notifications = window.data.notifications
    $scope.allSelected = false
    $scope.selectedProjects = []
    $scope.isArchiveableProjectSelected = false
    $scope.filter = 'all'
    $scope.predicate = 'lastUpdated'
    $scope.nUntagged = 0
    $scope.reverse = true
    $scope.searchText = { value: '' }
    $scope.$watch('predicate', function(newValue) {
      $scope.comparator =
        newValue === 'ownerName' ? ownerNameComparator : defaultComparator
    })

    $timeout(() => recalculateProjectListHeight(), 10)

    $scope.$watch(
      () =>
        $scope.projects.filter(
          project =>
            (project.tags == null || project.tags.length === 0) &&
            !project.archived
        ).length,
      newVal => ($scope.nUntagged = newVal)
    )

    var recalculateProjectListHeight = function() {
      const $projListCard = $('.project-list-card')
      if (!$projListCard) return

      const topOffset = $projListCard.offset().top
      const cardPadding = $projListCard.outerHeight() - $projListCard.height()
      const bottomOffset = $('footer').outerHeight()
      const height =
        $window.innerHeight - topOffset - bottomOffset - cardPadding
      $scope.projectListHeight = height
    }

    function defaultComparator(v1, v2) {
      var result = 0
      var type1 = v1.type
      var type2 = v2.type

      if ($scope.predicate === 'ownerName') {
        return
      }

      if (type1 === type2) {
        var value1 = v1.value
        var value2 = v2.value

        if (type1 === 'string') {
          // Compare strings case-insensitively
          value1 = value1.toLowerCase()
          value2 = value2.toLowerCase()
        } else if (type1 === 'object') {
          // For basic objects, use the position of the object
          // in the collection instead of the value
          if (angular.isObject(value1)) value1 = v1.index
          if (angular.isObject(value2)) value2 = v2.index
        }

        if (value1 !== value2) {
          result = value1 < value2 ? -1 : 1
        }
      } else {
        result = type1 < type2 ? -1 : 1
      }

      return result
    }

    function ownerNameComparator(v1, v2) {
      if ($scope.predicate !== 'ownerName') {
        return
      }
      if (v1.value === 'You') {
        if (v2.value === 'You') {
          return v1.index < v2.index ? -1 : 1
        } else {
          return 1
        }
      } else if (v1.value === 'An Overleaf v1 User' || v1.value === 'None') {
        if (v2.value === 'An Overleaf v1 User' || v2.value === 'None') {
          return v1.index < v2.index ? -1 : 1
        } else {
          return -1
        }
      } else {
        if (v2.value === 'You') {
          return -1
        } else if (v2.value === 'An Overleaf v1 User' || v2.value === 'None') {
          return 1
        } else {
          return v1.value > v2.value ? -1 : 1
        }
      }
    }

    angular.element($window).bind('resize', function() {
      recalculateProjectListHeight()
      $scope.$apply()
    })

    $scope.$on('project-list:notifications-received', () =>
      $scope.$applyAsync(() => recalculateProjectListHeight())
    )

    // Allow tags to be accessed on projects as well
    const projectsById = {}
    for (let project of $scope.projects) {
      projectsById[project.id] = project
    }

    $scope.getProjectById = id => projectsById[id]

    for (let tag of $scope.tags) {
      for (let projectId of tag.project_ids || []) {
        let project = projectsById[projectId]
        if (project) {
          if (!project.tags) {
            project.tags = []
          }
          project.tags.push(tag)
        }
      }
    }

    $scope.changePredicate = function(newPredicate) {
      if ($scope.predicate === newPredicate) {
        $scope.reverse = !$scope.reverse
      }
      $scope.predicate = newPredicate
    }

    $scope.getSortIconClass = function(column) {
      if (column === $scope.predicate && $scope.reverse) {
        return 'fa-caret-down'
      } else if (column === $scope.predicate && !$scope.reverse) {
        return 'fa-caret-up'
      } else {
        return ''
      }
    }

    $scope.searchProjects = function() {
      event_tracking.send(
        'project-list-page-interaction',
        'project-search',
        'keydown'
      )
      $scope.updateVisibleProjects()
    }

    $scope.clearSearchText = function() {
      $scope.searchText.value = ''
      $scope.filter = 'all'
      $scope.$emit('search:clear')
      $scope.updateVisibleProjects()
    }

    $scope.setFilter = function(filter) {
      $scope.filter = filter
      $scope.updateVisibleProjects()
    }

    $scope.updateSelectedProjects = function() {
      $scope.selectedProjects = $scope.projects.filter(
        project => project.selected
      )
      $scope.isArchiveableProjectSelected = $scope.selectedProjects.some(
        project => window.user_id === project.owner._id
      )
    }

    $scope.getSelectedProjects = () => $scope.selectedProjects

    $scope.getSelectedProjectIds = () =>
      $scope.selectedProjects.map(project => project.id)

    $scope.getFirstSelectedProject = () => $scope.selectedProjects[0]

    $scope.updateVisibleProjects = function() {
      $scope.visibleProjects = []
      const selectedTag = $scope.getSelectedTag()
      for (let project of $scope.projects) {
        let visible = true
        // Only show if it matches any search text
        if ($scope.searchText.value !== '') {
          if (
            project.name
              .toLowerCase()
              .indexOf($scope.searchText.value.toLowerCase()) === -1
          ) {
            visible = false
          }
        }
        // Only show if it matches the selected tag
        if (
          $scope.filter === 'tag' &&
          selectedTag != null &&
          !selectedTag.project_ids.includes(project.id)
        ) {
          visible = false
        }

        // Hide tagged projects if we only want to see the uncategorized ones
        if (
          $scope.filter === 'untagged' &&
          (project.tags != null ? project.tags.length : undefined) > 0
        ) {
          visible = false
        }

        // Hide projects we own if we only want to see shared projects
        if ($scope.filter === 'shared' && project.accessLevel === 'owner') {
          visible = false
        }

        // Hide projects from V1 if we only want to see shared projects
        if ($scope.filter === 'shared' && project.isV1Project) {
          visible = false
        }

        // Hide projects we don't own if we only want to see owned projects
        if ($scope.filter === 'owned' && project.accessLevel !== 'owner') {
          visible = false
        }

        if ($scope.filter === 'archived') {
          // Only show archived projects
          if (!project.archived) {
            visible = false
          }
        } else {
          // Only show non-archived projects
          if (project.archived) {
            visible = false
          }
        }

        if ($scope.filter === 'v1' && !project.isV1Project) {
          visible = false
        }

        if (visible) {
          $scope.visibleProjects.push(project)
        } else {
          // We don't want hidden selections
          project.selected = false
        }
      }

      localStorage(
        'project_list',
        JSON.stringify({
          filter: $scope.filter,
          selectedTagId: selectedTag != null ? selectedTag._id : undefined
        })
      )
      $scope.updateSelectedProjects()
    }

    $scope.getSelectedTag = function() {
      for (let tag of $scope.tags) {
        if (tag.selected) {
          return tag
        }
      }
      return null
    }

    $scope._removeProjectIdsFromTagArray = function(tag, removeProjectIds) {
      // Remove project_id from tag.project_ids
      const remainingProjectIds = []
      const removedProjectIds = []
      for (let projectId of tag.project_ids) {
        if (!removeProjectIds.includes(projectId)) {
          remainingProjectIds.push(projectId)
        } else {
          removedProjectIds.push(projectId)
        }
      }
      tag.project_ids = remainingProjectIds
      return removedProjectIds
    }

    $scope._removeProjectFromList = function(project) {
      const index = $scope.projects.indexOf(project)
      if (index > -1) {
        $scope.projects.splice(index, 1)
      }
    }

    $scope.removeSelectedProjectsFromTag = function(tag) {
      tag.showWhenEmpty = true

      const selectedProjectIds = $scope.getSelectedProjectIds()
      const selectedProjects = $scope.getSelectedProjects()

      const removedProjectIds = $scope._removeProjectIdsFromTagArray(
        tag,
        selectedProjectIds
      )

      // Remove tag from project.tags
      for (let project of selectedProjects) {
        if (!project.tags) {
          project.tags = []
        }
        const index = project.tags.indexOf(tag)
        if (index > -1) {
          project.tags.splice(index, 1)
        }
      }

      for (let projectId of removedProjectIds) {
        queuedHttp({
          method: 'DELETE',
          url: `/tag/${tag._id}/project/${projectId}`,
          headers: {
            'X-CSRF-Token': window.csrfToken
          }
        })
      }

      // If we're filtering by this tag then we need to remove
      // the projects from view
      $scope.updateVisibleProjects()
    }

    $scope.removeProjectFromTag = function(project, tag) {
      tag.showWhenEmpty = true

      if (!project.tags) {
        project.tags = []
      }
      const index = project.tags.indexOf(tag)

      if (index > -1) {
        $scope._removeProjectIdsFromTagArray(tag, [project.id])
        project.tags.splice(index, 1)
        queuedHttp({
          method: 'DELETE',
          url: `/tag/${tag._id}/project/${project.id}`,
          headers: {
            'X-CSRF-Token': window.csrfToken
          }
        })
        $scope.updateVisibleProjects()
      }
    }

    $scope.addSelectedProjectsToTag = function(tag) {
      const selectedProjects = $scope.getSelectedProjects()
      event_tracking.send(
        'project-list-page-interaction',
        'project action',
        'addSelectedProjectsToTag'
      )

      // Add project_ids into tag.project_ids
      const addedProjectIds = []
      for (let projectId of $scope.getSelectedProjectIds()) {
        if (!tag.project_ids.includes(projectId)) {
          tag.project_ids.push(projectId)
          addedProjectIds.push(projectId)
        }
      }

      // Add tag into each project.tags
      for (let project of selectedProjects) {
        if (!project.tags) {
          project.tags = []
        }
        if (!project.tags.includes(tag)) {
          project.tags.push(tag)
        }
      }

      for (let projectId of addedProjectIds) {
        queuedHttp.post(`/tag/${tag._id}/project/${projectId}`, {
          _csrf: window.csrfToken
        })
      }
    }

    $scope.openNewTagModal = function(e) {
      const modalInstance = $modal.open({
        templateUrl: 'newTagModalTemplate',
        controller: 'NewTagModalController'
      })

      modalInstance.result.then(function(tag) {
        const tagIsDuplicate = $scope.tags.find(function(existingTag) {
          return tag.name === existingTag.name
        })

        if (!tagIsDuplicate) {
          $scope.tags.push(tag)
          $scope.addSelectedProjectsToTag(tag)
        }
      })
    }

    $scope.createProject = function(name, template) {
      if (template == null) {
        template = 'none'
      }
      return queuedHttp
        .post('/project/new', {
          _csrf: window.csrfToken,
          projectName: name,
          template
        })
        .then(function(response) {
          const { data } = response
          $scope.projects.push({
            name,
            _id: data.project_id,
            accessLevel: 'owner',
            owner: {
              _id: window.user_id
            }
            // TODO: Check access level if correct after adding it in
            // to the rest of the app
          })
          $scope.updateVisibleProjects()
        })
    }

    $scope.openCreateProjectModal = function(template) {
      if (template == null) {
        template = 'none'
      }
      event_tracking.send(
        'project-list-page-interaction',
        'new-project',
        template
      )
      const modalInstance = $modal.open({
        templateUrl: 'newProjectModalTemplate',
        controller: 'NewProjectModalController',
        resolve: {
          template() {
            return template
          }
        },
        scope: $scope
      })

      modalInstance.result.then(
        projectId => (window.location = `/project/${projectId}`)
      )
    }

    $scope.renameProject = (project, newName) =>
      queuedHttp
        .post(`/project/${project.id}/rename`, {
          newProjectName: newName,
          _csrf: window.csrfToken
        })
        .then(() => (project.name = newName))

    $scope.openRenameProjectModal = function() {
      let project = $scope.getFirstSelectedProject()
      if (!project || project.accessLevel !== 'owner') {
        return
      }
      event_tracking.send(
        'project-list-page-interaction',
        'project action',
        'Rename'
      )
      $modal.open({
        templateUrl: 'renameProjectModalTemplate',
        controller: 'RenameProjectModalController',
        resolve: {
          project() {
            return project
          }
        },
        scope: $scope
      })
    }

    $scope.cloneProject = function(project, cloneName) {
      event_tracking.send(
        'project-list-page-interaction',
        'project action',
        'Clone'
      )
      return queuedHttp
        .post(`/project/${project.id}/clone`, {
          _csrf: window.csrfToken,
          projectName: cloneName
        })
        .then(function(response) {
          const { data } = response
          $scope.projects.push({
            name: data.name,
            id: data.project_id,
            accessLevel: 'owner',
            owner: {
              _id: data.owner_ref
            }
            // TODO: Check access level if correct after adding it in
            // to the rest of the app
          })
          $scope.updateVisibleProjects()
        })
    }

    $scope.openCloneProjectModal = function() {
      let project = $scope.getFirstSelectedProject()
      if (!project) {
        return
      }

      $modal.open({
        templateUrl: 'cloneProjectModalTemplate',
        controller: 'CloneProjectModalController',
        resolve: {
          project() {
            return project
          }
        },
        scope: $scope
      })
    }

    $scope.createArchiveProjectsModal = function(projects) {
      return $modal.open({
        templateUrl: 'deleteProjectsModalTemplate',
        controller: 'DeleteProjectsModalController',
        resolve: {
          projects() {
            return projects
          }
        }
      })
    }

    $scope.openArchiveProjectsModal = function() {
      const modalInstance = $scope.createArchiveProjectsModal(
        $scope.getSelectedProjects()
      )
      event_tracking.send(
        'project-list-page-interaction',
        'project action',
        'Delete'
      )
      modalInstance.result.then(() => $scope.archiveOrLeaveSelectedProjects())
    }

    $scope.archiveOrLeaveSelectedProjects = () =>
      $scope.archiveOrLeaveProjects($scope.getSelectedProjects())

    $scope.archiveOrLeaveProjects = function(projects) {
      for (let project of projects) {
        $scope.archiveOrLeaveProject(project)
      }
      $scope.updateVisibleProjects()
    }

    $scope.archiveOrLeaveProject = function(project) {
      if (project.accessLevel === 'owner') {
        project.archived = true
        queuedHttp({
          method: 'DELETE',
          url: `/project/${project.id}`,
          headers: {
            'X-CSRF-Token': window.csrfToken
          }
        })
      } else {
        $scope._removeProjectFromList(project)

        for (let tag of project.tags || []) {
          $scope._removeProjectIdsFromTagArray(tag, [project._id])
        }

        queuedHttp({
          method: 'POST',
          url: `/project/${project.id}/leave`,
          headers: {
            'X-CSRF-Token': window.csrfToken
          }
        })
      }
    }

    $scope.getValueForCurrentPredicate = function(project) {
      if ($scope.predicate === 'ownerName') {
        return ProjectListService.getOwnerName(project)
      } else {
        return project[$scope.predicate]
      }
    }

    $scope.openDeleteProjectsModal = function() {
      const modalInstance = $modal.open({
        templateUrl: 'deleteProjectsModalTemplate',
        controller: 'DeleteProjectsModalController',
        resolve: {
          projects() {
            return $scope.getSelectedProjects()
          }
        }
      })

      modalInstance.result.then(() => $scope.deleteSelectedProjects())
    }

    $scope.deleteSelectedProjects = function() {
      const selectedProjects = $scope.getSelectedProjects()
      const selectedProjectIds = $scope.getSelectedProjectIds()

      // Remove projects from array
      for (let project of selectedProjects) {
        $scope._removeProjectFromList(project)
      }

      // Remove project from any tags
      for (let tag of $scope.tags) {
        $scope._removeProjectIdsFromTagArray(tag, selectedProjectIds)
      }

      for (let projectId of selectedProjectIds) {
        queuedHttp({
          method: 'DELETE',
          url: `/project/${projectId}?forever=true`,
          headers: {
            'X-CSRF-Token': window.csrfToken
          }
        })
      }

      $scope.updateVisibleProjects()
    }

    $scope.restoreSelectedProjects = () =>
      $scope.restoreProjects($scope.getSelectedProjects())

    $scope.restoreProjects = function(projects) {
      const projectIds = projects.map(p => p.id)
      for (let project of projects) {
        project.archived = false
      }

      for (let projectId of projectIds) {
        queuedHttp({
          method: 'POST',
          url: `/project/${projectId}/restore`,
          headers: {
            'X-CSRF-Token': window.csrfToken
          }
        })
      }

      $scope.updateVisibleProjects()
    }

    $scope.openUploadProjectModal = function() {
      $modal.open({
        templateUrl: 'uploadProjectModalTemplate',
        controller: 'UploadProjectModalController'
      })
    }

    $scope.downloadSelectedProjects = () =>
      $scope.downloadProjectsById($scope.getSelectedProjectIds())

    $scope.downloadProjectsById = function(projectIds) {
      let path
      event_tracking.send(
        'project-list-page-interaction',
        'project action',
        'Download Zip'
      )
      if (projectIds.length > 1) {
        path = `/project/download/zip?project_ids=${projectIds.join(',')}`
      } else {
        path = `/project/${projectIds[0]}/download/zip`
      }
      return (window.location = path)
    }

    const markTagAsSelected = id => {
      for (let tag of $scope.tags) {
        if (tag._id === id) {
          tag.selected = true
        } else {
          tag.selected = false
        }
      }
    }

    const storedUIOpts = JSON.parse(localStorage('project_list'))

    if (storedUIOpts && storedUIOpts.filter) {
      if (storedUIOpts.filter === 'tag' && storedUIOpts.selectedTagId) {
        markTagAsSelected(storedUIOpts.selectedTagId)
      }
      $scope.setFilter(storedUIOpts.filter)
    } else {
      $scope.updateVisibleProjects()
    }
  })

  App.controller('ProjectListItemController', function(
    $scope,
    $modal,
    queuedHttp,
    ProjectListService
  ) {
    $scope.shouldDisableCheckbox = project =>
      $scope.filter === 'archived' && project.accessLevel !== 'owner'

    $scope.projectLink = function(project) {
      if (
        project.accessLevel === 'readAndWrite' &&
        project.source === 'token'
      ) {
        return `/${project.tokens.readAndWrite}`
      } else if (
        project.accessLevel === 'readOnly' &&
        project.source === 'token'
      ) {
        return `/read/${project.tokens.readOnly}`
      } else {
        return `/project/${project.id}`
      }
    }

    $scope.isLinkSharingProject = project => project.source === 'token'

    $scope.hasGenericOwnerName = () => {
      /* eslint-disable camelcase */
      const { first_name, last_name, email } = $scope.project.owner
      return !first_name && !last_name && !email
      /* eslint-enable camelcase */
    }

    $scope.getOwnerName = ProjectListService.getOwnerName

    $scope.getUserName = ProjectListService.getUserName

    $scope.isOwner = () =>
      $scope.project.owner && window.user_id === $scope.project.owner._id

    $scope.$watch('project.selected', function(value) {
      if (value != null) {
        $scope.updateSelectedProjects()
      }
    })

    $scope.clone = function(e) {
      e.stopPropagation()
      $scope.project.isTableActionInflight = true
      return $scope
        .cloneProject($scope.project, `${$scope.project.name} (Copy)`)
        .then(() => ($scope.project.isTableActionInflight = false))
        .catch(function(response) {
          const { data, status } = response
          const error = status === 400 ? { message: data } : true
          $modal.open({
            templateUrl: 'showErrorModalTemplate',
            controller: 'ShowErrorModalController',
            resolve: {
              error() {
                return error
              }
            }
          })
          $scope.project.isTableActionInflight = false
        })
    }

    $scope.download = function(e) {
      e.stopPropagation()
      $scope.downloadProjectsById([$scope.project.id])
    }

    $scope.archiveOrLeave = function(e) {
      e.stopPropagation()
      $scope.createArchiveProjectsModal([$scope.project]).result.then(() => {
        $scope.archiveOrLeaveProject($scope.project)
        $scope.updateVisibleProjects()
      })
    }

    $scope.restore = function(e) {
      e.stopPropagation()
      $scope.restoreProjects([$scope.project])
    }

    $scope.deleteProject = function(e) {
      e.stopPropagation()
      const modalInstance = $modal.open({
        templateUrl: 'deleteProjectsModalTemplate',
        controller: 'DeleteProjectsModalController',
        resolve: {
          projects() {
            return [$scope.project]
          }
        }
      })

      modalInstance.result.then(function() {
        $scope.project.isTableActionInflight = true
        return queuedHttp({
          method: 'DELETE',
          url: `/project/${$scope.project.id}?forever=true`,
          headers: {
            'X-CSRF-Token': window.csrfToken
          }
        })
          .then(function() {
            $scope.project.isTableActionInflight = false
            $scope._removeProjectFromList($scope.project)
            for (let tag of $scope.tags) {
              $scope._removeProjectIdsFromTagArray(tag, [$scope.project.id])
            }
            $scope.updateVisibleProjects()
          })
          .catch(() => ($scope.project.isTableActionInflight = false))
      })
    }
  })
})
