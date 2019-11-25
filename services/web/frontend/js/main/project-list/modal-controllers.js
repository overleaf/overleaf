/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], function(App) {
  App.controller('RenameProjectModalController', function(
    $scope,
    $modalInstance,
    $timeout,
    project,
    queuedHttp
  ) {
    $scope.inputs = { projectName: project.name }

    $scope.state = {
      inflight: false,
      error: false
    }

    $modalInstance.opened.then(() =>
      $timeout(() => $scope.$broadcast('open'), 200)
    )

    $scope.rename = function() {
      $scope.state.inflight = true
      $scope.state.error = false
      return $scope
        .renameProject(project, $scope.inputs.projectName)
        .then(function() {
          $scope.state.inflight = false
          $scope.state.error = false
          return $modalInstance.close()
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
  })

  App.controller('CloneProjectModalController', function(
    $scope,
    $modalInstance,
    $timeout,
    project
  ) {
    $scope.inputs = { projectName: project.name + ' (Copy)' }
    $scope.state = {
      inflight: false,
      error: false
    }

    $modalInstance.opened.then(() =>
      $timeout(() => $scope.$broadcast('open'), 200)
    )

    $scope.clone = function() {
      $scope.state.inflight = true
      return $scope
        .cloneProject(project, $scope.inputs.projectName)
        .then(function() {
          $scope.state.inflight = false
          $scope.state.error = false
          return $modalInstance.close()
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
  })

  App.controller('NewProjectModalController', function(
    $scope,
    $modalInstance,
    $timeout,
    template
  ) {
    $scope.inputs = { projectName: '' }
    $scope.state = {
      inflight: false,
      error: false
    }

    $modalInstance.opened.then(() =>
      $timeout(() => $scope.$broadcast('open'), 200)
    )

    $scope.create = function() {
      $scope.state.inflight = true
      $scope.state.error = false
      return $scope
        .createProject($scope.inputs.projectName, template)
        .then(function(response) {
          const { data } = response
          $scope.state.inflight = false
          $scope.state.error = false
          return $modalInstance.close(data.project_id)
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
  })

  App.controller('ArchiveTrashLeaveOrDeleteProjectsModalController', function(
    $scope,
    $modalInstance,
    $timeout,
    projects,
    action
  ) {
    $scope.projects = projects

    $scope.action = action

    $scope.confirm = () => $modalInstance.close({ projects, action })

    $scope.cancel = () => $modalInstance.dismiss('cancel')
  })

  App.controller('UploadProjectModalController', function(
    $scope,
    $modalInstance,
    $timeout
  ) {
    $scope.cancel = () => $modalInstance.dismiss('cancel')

    return ($scope.onComplete = function(error, name, response) {
      if (response.project_id != null) {
        return (window.location = `/project/${response.project_id}`)
      }
    })
  })

  App.controller('V1ImportModalController', function(
    $scope,
    $modalInstance,
    project
  ) {
    $scope.project = project

    return ($scope.dismiss = () => $modalInstance.dismiss('cancel'))
  })

  return App.controller('ShowErrorModalController', function(
    $scope,
    $modalInstance,
    error
  ) {
    $scope.error = error
    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  })
})
