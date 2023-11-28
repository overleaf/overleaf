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
  },
])
