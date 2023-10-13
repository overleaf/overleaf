import App from '../../base'

App.controller('EditorLoaderController', [
  '$scope',
  'localStorage',
  function ($scope, localStorage) {
    $scope.$watch('editor.showVisual', function (val) {
      localStorage(
        `editor.mode.${$scope.project_id}`,
        val === true ? 'rich-text' : 'source'
      )
    })

    $scope.$watch('editor.newSourceEditor', function (val) {
      localStorage(
        `editor.source_editor.${$scope.project_id}`,
        val === true ? 'cm6' : 'ace'
      )
    })
  },
])
