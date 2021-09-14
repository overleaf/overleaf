import App from '../../../base'
import { react2angular } from 'react2angular'
import WordCountModal from '../components/word-count-modal'
import { rootContext } from '../../../shared/context/root-context'

export default App.controller('WordCountModalController', function ($scope) {
  $scope.show = false

  $scope.handleHide = () => {
    $scope.$applyAsync(() => {
      $scope.show = false
    })
  }

  $scope.openWordCountModal = () => {
    $scope.$applyAsync(() => {
      $scope.show = true
    })
  }
})

App.component(
  'wordCountModal',
  react2angular(
    rootContext.use(WordCountModal),
    Object.keys(WordCountModal.propTypes)
  )
)
