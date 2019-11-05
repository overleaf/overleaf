define(['base', 'ide/colors/ColorManager'], function(App, ColorManager) {
  App.controller('TagListController', function($scope, $modal) {
    $scope.filterProjects = function(filter = 'all') {
      $scope._clearTags()
      $scope.setFilter(filter)
    }

    $scope._clearTags = () =>
      $scope.tags.forEach(tag => {
        tag.selected = false
      })

    $scope.selectTag = function(tag) {
      $scope._clearTags()
      tag.selected = true
      $scope.setFilter('tag')
    }

    $scope.selectUntagged = function() {
      $scope._clearTags()
      $scope.setFilter('untagged')
    }

    $scope.countProjectsForTag = function(tag) {
      return tag.project_ids.reduce((acc, projectId) => {
        const project = $scope.getProjectById(projectId)

        // There is a bug where the tag is not cleaned up when you leave a
        // project, so tag.project_ids can contain a project that the user can
        // no longer access. If the project cannot be found, ignore it
        if (!project) return acc

        // Ignore archived projects as they are not shown in the filter
        if (!project.archived) {
          return acc + 1
        } else {
          return acc
        }
      }, 0)
    }

    $scope.getHueForTagId = tagId => ColorManager.getHueForTagId(tagId)

    $scope.deleteTag = function(tag) {
      const modalInstance = $modal.open({
        templateUrl: 'deleteTagModalTemplate',
        controller: 'DeleteTagModalController',
        resolve: {
          tag() {
            return tag
          }
        }
      })
      modalInstance.result.then(function() {
        // Remove tag from projects
        for (let project of $scope.projects) {
          if (!project.tags) {
            project.tags = []
          }
          const index = project.tags.indexOf(tag)
          if (index > -1) {
            project.tags.splice(index, 1)
          }
        }
        // Remove tag
        $scope.tags = $scope.tags.filter(t => t !== tag)
      })
    }

    $scope.renameTag = function(tag) {
      const modalInstance = $modal.open({
        templateUrl: 'renameTagModalTemplate',
        controller: 'RenameTagModalController',
        resolve: {
          tag() {
            return tag
          }
        }
      })
      modalInstance.result.then(newName => (tag.name = newName))
    }
  })

  App.controller('TagDropdownItemController', function($scope) {
    $scope.recalculateProjectsInTag = function() {
      let partialSelection
      $scope.areSelectedProjectsInTag = false
      for (let projectId of $scope.getSelectedProjectIds()) {
        if ($scope.tag.project_ids.includes(projectId)) {
          $scope.areSelectedProjectsInTag = true
        } else {
          partialSelection = true
        }
      }

      if ($scope.areSelectedProjectsInTag && partialSelection) {
        $scope.areSelectedProjectsInTag = 'partial'
      }
    }

    $scope.addOrRemoveProjectsFromTag = function() {
      if ($scope.areSelectedProjectsInTag === true) {
        $scope.removeSelectedProjectsFromTag($scope.tag)
        $scope.areSelectedProjectsInTag = false
      } else if (
        $scope.areSelectedProjectsInTag === false ||
        $scope.areSelectedProjectsInTag === 'partial'
      ) {
        $scope.addSelectedProjectsToTag($scope.tag)
        $scope.areSelectedProjectsInTag = true
      }
    }

    $scope.$watch('selectedProjects', () => $scope.recalculateProjectsInTag())
    $scope.recalculateProjectsInTag()
  })

  App.controller('NewTagModalController', function(
    $scope,
    $modalInstance,
    $timeout,
    $http
  ) {
    $scope.inputs = { newTagName: '' }

    $scope.state = {
      inflight: false,
      error: false
    }

    $modalInstance.opened.then(() =>
      $timeout(() => $scope.$broadcast('open'), 200)
    )

    $scope.create = function() {
      const name = $scope.inputs.newTagName
      $scope.state.inflight = true
      $scope.state.error = false
      $http
        .post('/tag', {
          _csrf: window.csrfToken,
          name
        })
        .then(function(response) {
          const { data } = response
          $scope.state.inflight = false
          $modalInstance.close(data)
        })
        .catch(function() {
          $scope.state.inflight = false
          $scope.state.error = true
        })
    }

    $scope.cancel = () => $modalInstance.dismiss('cancel')
  })

  App.controller('RenameTagModalController', function(
    $scope,
    $modalInstance,
    $timeout,
    $http,
    tag
  ) {
    $scope.inputs = { tagName: tag.name }

    $scope.state = {
      inflight: false,
      error: false
    }

    $modalInstance.opened.then(() =>
      $timeout(() => $scope.$broadcast('open'), 200)
    )

    $scope.rename = function() {
      const name = $scope.inputs.tagName
      $scope.state.inflight = true
      $scope.state.error = false
      return $http
        .post(`/tag/${tag._id}/rename`, {
          _csrf: window.csrfToken,
          name
        })
        .then(function() {
          $scope.state.inflight = false
          $modalInstance.close(name)
        })
        .catch(function() {
          $scope.state.inflight = false
          $scope.state.error = true
        })
    }

    $scope.cancel = () => $modalInstance.dismiss('cancel')
  })

  return App.controller('DeleteTagModalController', function(
    $scope,
    $modalInstance,
    $http,
    tag
  ) {
    $scope.tag = tag
    $scope.state = {
      inflight: false,
      error: false
    }

    $scope.delete = function() {
      $scope.state.inflight = true
      $scope.state.error = false
      return $http({
        method: 'DELETE',
        url: `/tag/${tag._id}`,
        headers: {
          'X-CSRF-Token': window.csrfToken
        }
      })
        .then(function() {
          $scope.state.inflight = false
          $modalInstance.close()
        })
        .catch(function() {
          $scope.state.inflight = false
          $scope.state.error = true
        })
    }

    $scope.cancel = () => $modalInstance.dismiss('cancel')
  })
})
