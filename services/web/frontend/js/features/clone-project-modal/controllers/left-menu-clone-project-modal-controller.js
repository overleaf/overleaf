import App from '../../../base'
import { react2angular } from 'react2angular'
import EditorCloneProjectModalWrapper from '../components/editor-clone-project-modal-wrapper'
import { rootContext } from '../../../shared/context/root-context'
import { assign } from '../../../shared/components/location'

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
      assign(`/project/${project.project_id}`)
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
