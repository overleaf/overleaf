import App from '../../../base'
import { react2angular } from 'react2angular'

import HotkeysModal from '../components/hotkeys-modal'

App.component('hotkeysModal', react2angular(HotkeysModal))

export default App.controller('HotkeysModalController', function($scope) {
  $scope.show = false

  $scope.handleHide = () => {
    $scope.$applyAsync(() => {
      $scope.show = false
    })
  }

  $scope.openHotkeysModal = () => {
    $scope.trackChangesVisible =
      $scope.project && $scope.project.features.trackChangesVisible

    $scope.$applyAsync(() => {
      $scope.show = true
    })
  }
})
