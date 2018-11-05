/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], function(App) {
  App.controller('TagListController', function($scope, $modal) {
    $scope.filterProjects = function(filter) {
      if (filter == null) {
        filter = 'all'
      }
      $scope._clearTags()
      return $scope.setFilter(filter)
    }

    $scope._clearTags = () =>
      Array.from($scope.tags).map(tag => (tag.selected = false))

    $scope.selectTag = function(tag) {
      $scope._clearTags()
      tag.selected = true
      return $scope.setFilter('tag')
    }

    $scope.selectUntagged = function() {
      $scope._clearTags()
      return $scope.setFilter('untagged')
    }

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
      return modalInstance.result.then(function() {
        // Remove tag from projects
        for (let project of Array.from($scope.projects)) {
          if (!project.tags) {
            project.tags = []
          }
          const index = project.tags.indexOf(tag)
          if (index > -1) {
            project.tags.splice(index, 1)
          }
        }
        // Remove tag
        return ($scope.tags = $scope.tags.filter(t => t !== tag))
      })
    }

    return ($scope.renameTag = function(tag) {
      const modalInstance = $modal.open({
        templateUrl: 'renameTagModalTemplate',
        controller: 'RenameTagModalController',
        resolve: {
          tag() {
            return tag
          },
          existing_tags() {
            return $scope.tags
          }
        }
      })
      return modalInstance.result.then(new_name => (tag.name = new_name))
    })
  })

  App.controller('TagDropdownItemController', function($scope) {
    $scope.recalculateProjectsInTag = function() {
      let partialSelection
      $scope.areSelectedProjectsInTag = false
      for (let project_id of Array.from($scope.getSelectedProjectIds())) {
        if (Array.from($scope.tag.project_ids).includes(project_id)) {
          $scope.areSelectedProjectsInTag = true
        } else {
          partialSelection = true
        }
      }

      if ($scope.areSelectedProjectsInTag && partialSelection) {
        return ($scope.areSelectedProjectsInTag = 'partial')
      }
    }

    $scope.addOrRemoveProjectsFromTag = function() {
      if ($scope.areSelectedProjectsInTag === true) {
        $scope.removeSelectedProjectsFromTag($scope.tag)
        return ($scope.areSelectedProjectsInTag = false)
      } else if (
        $scope.areSelectedProjectsInTag === false ||
        $scope.areSelectedProjectsInTag === 'partial'
      ) {
        $scope.addSelectedProjectsToTag($scope.tag)
        return ($scope.areSelectedProjectsInTag = true)
      }
    }

    $scope.$watch('selectedProjects', () => $scope.recalculateProjectsInTag())
    return $scope.recalculateProjectsInTag()
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
      return $http
        .post('/tag', {
          _csrf: window.csrfToken,
          name
        })
        .then(function(response) {
          const { data } = response
          $scope.state.inflight = false
          return $modalInstance.close(data)
        })
        .catch(function() {
          $scope.state.inflight = false
          return ($scope.state.error = true)
        })
    }

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  })

  App.controller('RenameTagModalController', function(
    $scope,
    $modalInstance,
    $timeout,
    $http,
    tag,
    existing_tags
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
          return $modalInstance.close(name)
        })
        .catch(function() {
          $scope.state.inflight = false
          return ($scope.state.error = true)
        })
    }

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
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
          return $modalInstance.close()
        })
        .catch(function() {
          $scope.state.inflight = false
          return ($scope.state.error = true)
        })
    }

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  })
})
