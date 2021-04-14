import App from '../../../base'
import { react2angular } from 'react2angular'

import HotkeysModal from '../components/hotkeys-modal'

App.component('hotkeysModal', react2angular(HotkeysModal, undefined))

export default App.controller('HotkeysModalController', function ($scope) {
  $scope.show = false
  $scope.isMac = /Mac/i.test(navigator.platform)

  $scope.handleHide = () => {
    $scope.$applyAsync(() => {
      $scope.show = false
    })
  }

  $scope.openHotkeysModal = () => {
    $scope.$applyAsync(() => {
      $scope.trackChangesVisible =
        $scope.project && $scope.project.features.trackChangesVisible

      $scope.show = true
    })
  }
})
