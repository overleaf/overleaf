import App from '../../../base'
import { react2angular } from 'react2angular'

import CloneProjectModal from '../components/clone-project-modal'

App.component('cloneProjectModal', react2angular(CloneProjectModal))

export default App.controller('LeftMenuCloneProjectModalController', function(
  $scope,
  ide
) {
  $scope.show = false
  $scope.projectId = ide.$scope.project_id

  $scope.handleHide = () => {
    $scope.$applyAsync(() => {
      $scope.show = false
    })
  }

  $scope.openProject = projectId => {
    window.location.assign(`/project/${projectId}`)
  }

  $scope.openCloneProjectModal = () => {
    $scope.$applyAsync(() => {
      const { project } = ide.$scope

      if (project) {
        $scope.projectId = project._id
        $scope.projectName = project.name

        $scope.show = true

        // TODO: is this needed
        window.setTimeout(() => {
          $scope.$broadcast('open')
        }, 200)
      }
    })
  }
})
