import App from '../../../base'
import { react2angular } from 'react2angular'
import CloneProjectModal from '../components/clone-project-modal'
import { rootContext } from '../../../shared/context/root-context'

export default App.controller(
  'LeftMenuCloneProjectModalController',
  function ($scope) {
    $scope.show = false

    $scope.handleHide = () => {
      $scope.$applyAsync(() => {
        $scope.show = false
      })
    }

    $scope.openCloneProjectModal = () => {
      $scope.$applyAsync(() => {
        $scope.show = true
      })
    }

    $scope.openProject = projectId => {
      window.location.assign(`/project/${projectId}`)
    }
  }
)

App.component(
  'cloneProjectModal',
  react2angular(
    rootContext.use(CloneProjectModal),
    Object.keys(CloneProjectModal.propTypes)
  )
)
