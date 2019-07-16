/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
    no-unused-vars,
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
  const MAX_PROJECT_NAME_LENGTH = 150
  return App.controller('ProjectNameController', function(
    $scope,
    $element,
    settings,
    ide
  ) {
    const projectNameReadOnlyEl = $element.find('.name')[0]

    $scope.state = {
      renaming: false,
      overflowed: false
    }

    $scope.inputs = {}

    $scope.startRenaming = function() {
      $scope.inputs.name = $scope.project.name
      $scope.state.renaming = true
      return $scope.$emit('project:rename:start')
    }

    $scope.finishRenaming = function() {
      $scope.state.renaming = false
      const newName = $scope.inputs.name
      if ($scope.project.name === newName) {
        return
      }
      const oldName = $scope.project.name
      $scope.project.name = newName
      return settings
        .saveProjectSettings({ name: $scope.project.name })
        .catch(function(response) {
          const { data, status } = response
          $scope.project.name = oldName
          if (status === 400) {
            return ide.showGenericMessageModal('Error renaming project', data)
          } else {
            return ide.showGenericMessageModal(
              'Error renaming project',
              'Please try again in a moment'
            )
          }
        })
    }

    ide.socket.on('projectNameUpdated', name =>
      $scope.$apply(() => ($scope.project.name = name))
    )

    return $scope.$watch('project.name', function(name) {
      if (name != null) {
        window.document.title =
          name + ` - Online LaTeX Editor ${ExposedSettings.appName}`
        return $scope.$applyAsync(
          () =>
            // This ensures that the element is measured *after* the binding is done (i.e. project name is rendered).
            ($scope.state.overflowed =
              projectNameReadOnlyEl.scrollWidth >
              projectNameReadOnlyEl.clientWidth)
        )
      }
    })
  })
})
