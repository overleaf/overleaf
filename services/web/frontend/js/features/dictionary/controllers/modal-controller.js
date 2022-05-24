import App from '../../../base'
import { react2angular } from 'react2angular'
import DictionaryModal from '../components/dictionary-modal'
import { rootContext } from '../../../shared/context/root-context'

export default App.controller('DictionaryModalController', function ($scope) {
  $scope.show = false

  $scope.handleHide = () => {
    $scope.$applyAsync(() => {
      $scope.show = false
      window.dispatchEvent(new CustomEvent('learnedWords:reset'))
    })
  }

  $scope.openModal = () => {
    $scope.$applyAsync(() => {
      $scope.show = true
    })
  }
})

App.component(
  'dictionaryModal',
  react2angular(rootContext.use(DictionaryModal), ['show', 'handleHide'])
)
