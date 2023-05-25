/* eslint-disable
    n/handle-callback-err,
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../../base'
App.controller(
  'CloneProjectModalController',
  function ($scope, $modalInstance, $timeout, project) {
    $scope.inputs = { projectName: project.name + ' (Copy)' }
    $scope.state = {
      inflight: false,
      error: false,
    }

    $modalInstance.opened.then(() =>
      $timeout(() => $scope.$broadcast('open'), 200)
    )

    $scope.clone = function () {
      $scope.state.inflight = true
      return $scope
        .cloneProject(project, $scope.inputs.projectName)
        .then(function () {
          $scope.state.inflight = false
          $scope.state.error = false
          return $modalInstance.close()
        })
        .catch(function (response) {
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
  }
)

App.controller(
  'ArchiveTrashLeaveOrDeleteProjectsModalController',
  function ($scope, $modalInstance, $timeout, projects, action) {
    $scope.projects = projects

    $scope.action = action

    $scope.confirm = () => $modalInstance.close({ projects, action })

    $scope.cancel = () => $modalInstance.dismiss('cancel')
  }
)
