import App from '../../../base'
import { react2angular } from 'react2angular'
import cloneDeep from 'lodash/cloneDeep'

import ShareProjectModal from '../components/share-project-modal'
import { listProjectInvites, listProjectMembers } from '../utils/api'

App.component('shareProjectModal', react2angular(ShareProjectModal))

export default App.controller('ReactShareProjectModalController', function(
  $scope,
  eventTracking,
  ide
) {
  $scope.isAdmin = false
  $scope.show = false

  let deregisterProjectWatch

  // deep watch $scope.project for changes
  function registerProjectWatch() {
    deregisterProjectWatch = $scope.$watch(
      'project',
      project => {
        $scope.clonedProject = cloneDeep(project)
      },
      true
    )
  }

  $scope.handleHide = () => {
    $scope.$applyAsync(() => {
      $scope.show = false
      if (deregisterProjectWatch) {
        deregisterProjectWatch()
      }
    })
  }

  $scope.openShareProjectModal = isAdmin => {
    eventTracking.sendMBOnce('ide-open-share-modal-once')
    $scope.$applyAsync(() => {
      registerProjectWatch()

      $scope.isAdmin = isAdmin
      $scope.show = true
    })
  }

  // update $scope.project with new data
  $scope.updateProject = data => {
    if (!$scope.project) {
      return
    }

    $scope.$applyAsync(() => {
      Object.assign($scope.project, data)
    })
  }

  /* tokens */

  ide.socket.on('project:tokens:changed', data => {
    if (data.tokens != null) {
      ide.$scope.project.tokens = data.tokens
      $scope.$digest()
    }
  })

  ide.socket.on('project:membership:changed', data => {
    if (data.members) {
      listProjectMembers($scope.project)
        .then(({ members }) => {
          if (members) {
            $scope.$applyAsync(() => {
              $scope.project.members = members
            })
          }
        })
        .catch(() => {
          console.error('Error fetching members for project')
        })
    }

    if (data.invites) {
      listProjectInvites($scope.project)
        .then(({ invites }) => {
          if (invites) {
            $scope.$applyAsync(() => {
              $scope.project.invites = invites
            })
          }
        })
        .catch(() => {
          console.error('Error fetching invites for project')
        })
    }
  })
})
