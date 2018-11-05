/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('CloneProjectModalController', function(
    $scope,
    $modalInstance,
    $timeout,
    $http,
    ide
  ) {
    $scope.inputs = { projectName: ide.$scope.project.name + ' (Copy)' }
    $scope.state = {
      inflight: false,
      error: false
    }

    $modalInstance.opened.then(() =>
      $timeout(() => $scope.$broadcast('open'), 200)
    )

    const cloneProject = cloneName =>
      $http.post(`/project/${ide.$scope.project._id}/clone`, {
        _csrf: window.csrfToken,
        projectName: cloneName
      })

    $scope.clone = function() {
      $scope.state.inflight = true
      $scope.state.error = false
      return cloneProject($scope.inputs.projectName)
        .then(function(response) {
          const { data } = response
          return (window.location = `/project/${data.project_id}`)
        })
        .catch(function(response) {
          const { data, status } = response
          $scope.state.inflight = false
          if (status === 400) {
            return ($scope.state.error = { message: data })
          } else {
            return ($scope.state.error = true)
          }
        })
    }

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  }))
