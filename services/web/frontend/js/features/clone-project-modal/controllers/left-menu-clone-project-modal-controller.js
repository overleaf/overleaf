import App from '../../../base'
import { react2angular } from 'react2angular'
import EditorCloneProjectModalWrapper from '../components/editor-clone-project-modal-wrapper'
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

    $scope.openProject = project => {
      window.location.assign(`/project/${project.project_id}`)
    }
  }
)

App.component(
  'cloneProjectModal',
  react2angular(
    rootContext.use(EditorCloneProjectModalWrapper),
    Object.keys(EditorCloneProjectModalWrapper.propTypes)
  )
)
