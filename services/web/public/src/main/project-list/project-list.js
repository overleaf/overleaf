/* eslint-disable
    camelcase,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base', 'main/project-list/services/project-list'], function(App) {
  App.controller('ProjectPageController', function(
    $scope,
    $modal,
    $q,
    $window,
    queuedHttp,
    event_tracking,
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
    $scope.shouldShowSurveyLink = false

    const surveyStartDate = new Date(2019, 3, 2)

    if (
      localStorage('dismissed-survey') === true ||
      new Date() < surveyStartDate
    ) {
      $scope.shouldShowSurveyLink = false
    } else {
      const _v2LaunchDate = new Date(2019, 0, 8)
      let _nRecentProjects = 0

      for (let project of $scope.projects) {
        if (
          project.accessLevel === 'owner' &&
          new Date(project.lastUpdated) > _v2LaunchDate
        ) {
          if (++_nRecentProjects > 1) {
            $scope.shouldShowSurveyLink = true
            break
          }
        }
      }
    }

    $scope.dismissSurvey = () => {
      localStorage('dismissed-survey', true)
      $scope.shouldShowSurveyLink = false
    }

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

    const storedUIOpts = JSON.parse(localStorage('project_list'))

    var recalculateProjectListHeight = function() {
      const $projListCard = $('.project-list-card')
      const topOffset = __guard__($projListCard.offset(), x => x.top)
      const cardPadding = $projListCard.outerHeight() - $projListCard.height()
      const bottomOffset = $('footer').outerHeight()
      const height =
        $window.innerHeight - topOffset - bottomOffset - cardPadding
      return ($scope.projectListHeight = height)
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
      return $scope.$apply()
    })

    $scope.$on('project-list:notifications-received', () =>
      $scope.$applyAsync(() => recalculateProjectListHeight())
    )

    // Allow tags to be accessed on projects as well
    const projectsById = {}
    for (var project of Array.from($scope.projects)) {
      projectsById[project.id] = project
    }

    for (var tag of Array.from($scope.tags)) {
      for (let project_id of Array.from(tag.project_ids || [])) {
        project = projectsById[project_id]
        if (project != null) {
          if (!project.tags) {
            project.tags = []
          }
          project.tags.push(tag)
        }
      }
    }

    const markTagAsSelected = id =>
      (() => {
        const result = []
        for (tag of Array.from($scope.tags)) {
          if (tag._id === id) {
            result.push((tag.selected = true))
          } else {
            result.push((tag.selected = false))
          }
        }
        return result
      })()

    $scope.changePredicate = function(newPredicate) {
      if ($scope.predicate === newPredicate) {
        $scope.reverse = !$scope.reverse
      }
      return ($scope.predicate = newPredicate)
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
      return $scope.updateVisibleProjects()
    }

    $scope.clearSearchText = function() {
      $scope.searchText.value = ''
      $scope.filter = 'all'
      $scope.$emit('search:clear')
      return $scope.updateVisibleProjects()
    }

    $scope.setFilter = function(filter) {
      $scope.filter = filter
      return $scope.updateVisibleProjects()
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
      for (project of Array.from($scope.projects)) {
        let visible = true
        // Only show if it matches any search text
        if ($scope.searchText.value != null && $scope.searchText.value !== '') {
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
          !Array.from(selectedTag.project_ids).includes(project.id)
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
      return $scope.updateSelectedProjects()
    }

    $scope.getSelectedTag = function() {
      for (tag of Array.from($scope.tags)) {
        if (tag.selected) {
          return tag
        }
      }
      return null
    }

    $scope._removeProjectIdsFromTagArray = function(tag, remove_project_ids) {
      // Remove project_id from tag.project_ids
      const remaining_project_ids = []
      const removed_project_ids = []
      for (let project_id of Array.from(tag.project_ids)) {
        if (!Array.from(remove_project_ids).includes(project_id)) {
          remaining_project_ids.push(project_id)
        } else {
          removed_project_ids.push(project_id)
        }
      }
      tag.project_ids = remaining_project_ids
      return removed_project_ids
    }

    $scope._removeProjectFromList = function(project) {
      const index = $scope.projects.indexOf(project)
      if (index > -1) {
        return $scope.projects.splice(index, 1)
      }
    }

    $scope.removeSelectedProjectsFromTag = function(tag) {
      tag.showWhenEmpty = true

      const selected_project_ids = $scope.getSelectedProjectIds()
      const selected_projects = $scope.getSelectedProjects()

      const removed_project_ids = $scope._removeProjectIdsFromTagArray(
        tag,
        selected_project_ids
      )

      // Remove tag from project.tags
      for (project of Array.from(selected_projects)) {
        if (!project.tags) {
          project.tags = []
        }
        const index = project.tags.indexOf(tag)
        if (index > -1) {
          project.tags.splice(index, 1)
        }
      }

      for (let project_id of Array.from(removed_project_ids)) {
        queuedHttp({
          method: 'DELETE',
          url: `/tag/${tag._id}/project/${project_id}`,
          headers: {
            'X-CSRF-Token': window.csrfToken
          }
        })
      }

      // If we're filtering by this tag then we need to remove
      // the projects from view
      return $scope.updateVisibleProjects()
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
        return $scope.updateVisibleProjects()
      }
    }

    $scope.addSelectedProjectsToTag = function(tag) {
      const selected_projects = $scope.getSelectedProjects()
      event_tracking.send(
        'project-list-page-interaction',
        'project action',
        'addSelectedProjectsToTag'
      )

      // Add project_ids into tag.project_ids
      const added_project_ids = []
      for (let project_id of Array.from($scope.getSelectedProjectIds())) {
        if (!Array.from(tag.project_ids).includes(project_id)) {
          tag.project_ids.push(project_id)
          added_project_ids.push(project_id)
        }
      }

      // Add tag into each project.tags
      for (project of Array.from(selected_projects)) {
        if (!project.tags) {
          project.tags = []
        }
        if (!Array.from(project.tags).includes(tag)) {
          project.tags.push(tag)
        }
      }

      return (() => {
        const result = []
        for (let project_id of Array.from(added_project_ids)) {
          result.push(
            queuedHttp.post(`/tag/${tag._id}/project/${project_id}`, {
              _csrf: window.csrfToken
            })
          )
        }
        return result
      })()
    }

    $scope.createTag = name => tag

    $scope.openNewTagModal = function(e) {
      const modalInstance = $modal.open({
        templateUrl: 'newTagModalTemplate',
        controller: 'NewTagModalController'
      })

      return modalInstance.result.then(function(tag) {
        const tagIsDuplicate = $scope.tags.find(function(existingTag) {
          return tag.name === existingTag.name
        })

        if (!tagIsDuplicate) {
          $scope.tags.push(tag)
          return $scope.addSelectedProjectsToTag(tag)
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
          return $scope.updateVisibleProjects()
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

      return modalInstance.result.then(
        project_id => (window.location = `/project/${project_id}`)
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
      project = $scope.getFirstSelectedProject()
      if (project == null || project.accessLevel !== 'owner') {
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
          return $scope.updateVisibleProjects()
        })
    }

    $scope.openCloneProjectModal = function() {
      project = $scope.getFirstSelectedProject()
      if (project == null) {
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
      return modalInstance.result.then(() =>
        $scope.archiveOrLeaveSelectedProjects()
      )
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

      return modalInstance.result.then(() => $scope.deleteSelectedProjects())
    }

    $scope.deleteSelectedProjects = function() {
      const selected_projects = $scope.getSelectedProjects()
      const selected_project_ids = $scope.getSelectedProjectIds()

      // Remove projects from array
      for (project of Array.from(selected_projects)) {
        $scope._removeProjectFromList(project)
      }

      // Remove project from any tags
      for (tag of Array.from($scope.tags)) {
        $scope._removeProjectIdsFromTagArray(tag, selected_project_ids)
      }

      for (let project_id of Array.from(selected_project_ids)) {
        queuedHttp({
          method: 'DELETE',
          url: `/project/${project_id}?forever=true`,
          headers: {
            'X-CSRF-Token': window.csrfToken
          }
        })
      }

      return $scope.updateVisibleProjects()
    }

    $scope.restoreSelectedProjects = () =>
      $scope.restoreProjects($scope.getSelectedProjects())

    $scope.restoreProjects = function(projects) {
      const projectIds = projects.map(p => p.id)
      for (project of Array.from(projects)) {
        project.archived = false
      }

      for (let projectId of Array.from(projectIds)) {
        queuedHttp({
          method: 'POST',
          url: `/project/${projectId}/restore`,
          headers: {
            'X-CSRF-Token': window.csrfToken
          }
        })
      }

      return $scope.updateVisibleProjects()
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

    $scope.openV1ImportModal = project =>
      $modal.open({
        templateUrl: 'v1ImportModalTemplate',
        controller: 'V1ImportModalController',
        size: 'lg',
        windowClass: 'v1-import-modal',
        resolve: {
          project() {
            return project
          }
        }
      })

    if ((storedUIOpts != null ? storedUIOpts.filter : undefined) != null) {
      if (storedUIOpts.filter === 'tag' && storedUIOpts.selectedTagId != null) {
        markTagAsSelected(storedUIOpts.selectedTagId)
      }
      return $scope.setFilter(storedUIOpts.filter)
    } else {
      return $scope.updateVisibleProjects()
    }
  })

  return App.controller('ProjectListItemController', function(
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
      const { first_name, last_name, email } = $scope.project.owner
      return !first_name && !last_name && !email
    }

    $scope.getOwnerName = ProjectListService.getOwnerName

    $scope.isOwner = () => window.user_id === $scope.project.owner._id

    $scope.$watch('project.selected', function(value) {
      if (value != null) {
        return $scope.updateSelectedProjects()
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
          return ($scope.project.isTableActionInflight = false)
        })
    }

    $scope.download = function(e) {
      e.stopPropagation()
      return $scope.downloadProjectsById([$scope.project.id])
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
      return $scope.restoreProjects([$scope.project])
    }

    return ($scope.deleteProject = function(e) {
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

      return modalInstance.result.then(function() {
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
            for (let tag of Array.from($scope.tags)) {
              $scope._removeProjectIdsFromTagArray(tag, [$scope.project.id])
            }
            return $scope.updateVisibleProjects()
          })
          .catch(() => ($scope.project.isTableActionInflight = false))
      })
    })
  })
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
