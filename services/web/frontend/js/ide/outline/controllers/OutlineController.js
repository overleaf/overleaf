import App from '../../../base'
import OutlinePane from '../components/OutlinePane'
import { react2angular } from 'react2angular'

App.controller('OutlineController', function($scope, ide, eventTracking) {
  $scope.isTexFile = false
  $scope.outline = []
  $scope.eventTracking = eventTracking

  $scope.$on('outline-manager:outline-changed', onOutlineChange)

  function onOutlineChange(e, outlineInfo) {
    $scope.$applyAsync(() => {
      $scope.isTexFile = outlineInfo.isTexFile
      $scope.outline = outlineInfo.outline
      $scope.highlightedLine = outlineInfo.highlightedLine
    })
  }

  $scope.jumpToLine = lineNo => {
    ide.outlineManager.jumpToLine(lineNo)
    eventTracking.sendMB('outline-jump-to-line')
  }

  $scope.onToggle = isOpen => {
    $scope.$applyAsync(() => {
      $scope.$emit('outline-toggled', isOpen)
    })
  }
})

// Wrap React component as Angular component. Only needed for "top-level" component
App.component('outlinePane', react2angular(OutlinePane))
