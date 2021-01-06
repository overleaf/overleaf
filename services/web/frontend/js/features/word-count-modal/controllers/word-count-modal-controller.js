import App from '../../../base'
import { react2angular } from 'react2angular'

import WordCountModal from '../components/word-count-modal'

App.component('wordCountModal', react2angular(WordCountModal))

export default App.controller('WordCountModalController', function(
  $scope,
  ide
) {
  $scope.show = false
  $scope.projectId = ide.project_id

  $scope.handleHide = () => {
    $scope.$applyAsync(() => {
      $scope.show = false
    })
  }

  $scope.openWordCountModal = () => {
    $scope.$applyAsync(() => {
      $scope.projectId = ide.project_id
      $scope.show = true
    })
  }
})
