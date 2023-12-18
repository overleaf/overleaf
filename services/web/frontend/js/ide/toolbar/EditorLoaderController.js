import App from '../../base'

App.controller('EditorLoaderController', [
  '$scope',
  'localStorage',
  function ($scope, localStorage) {
    $scope.$watch('editor.showVisual', function (val) {
      localStorage(`editor.lastUsedMode`, val === true ? 'visual' : 'code')
    })
  },
])
