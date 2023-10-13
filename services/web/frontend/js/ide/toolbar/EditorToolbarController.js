import App from '../../base'
import importOverleafModules from '../../../macros/import-overleaf-module.macro'

const eModules = importOverleafModules('editorToolbarButtons')
const editorToolbarButtons = eModules.map(item => item.import.default)

export default App.controller('EditorToolbarController', [
  '$scope',
  'ide',
  function ($scope, ide) {
    const editorButtons = []

    for (const editorToolbarButton of editorToolbarButtons) {
      const button = editorToolbarButton.button($scope, ide)

      if (editorToolbarButton.source) {
        editorButtons.push(button)
      }
    }

    $scope.editorButtons = editorButtons
  },
])
