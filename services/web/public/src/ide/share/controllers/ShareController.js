define(['base'], App => {
  App.controller('ShareController', function(
    $scope,
    $modal,
    ide,
    projectInvites,
    projectMembers,
    // eslint-disable-next-line camelcase
    eventTracking
  ) {
    $scope.openShareProjectModal = function(isAdmin) {
      $scope.isAdmin = isAdmin
      eventTracking.sendMBOnce('ide-open-share-modal-once')

      $modal.open({
        templateUrl: 'shareProjectModalTemplate',
        controller: 'ShareProjectModalController',
        scope: $scope
      })
    }

    ide.socket.on('project:tokens:changed', data => {
      if (data.tokens != null) {
        ide.$scope.project.tokens = data.tokens
        $scope.$digest()
      }
    })

    ide.socket.on('project:membership:changed', data => {
      if (data.members) {
        projectMembers
          .getMembers()
          .then(response => {
            if (response.data.members) {
              $scope.project.members = response.data.members
            }
          })
          .catch(() => {
            console.error('Error fetching members for project')
          })
      }
      if (data.invites) {
        projectInvites
          .getInvites()
          .then(response => {
            if (response.data.invites) {
              $scope.project.invites = response.data.invites
            }
          })
          .catch(() => {
            console.error('Error fetching invites for project')
          })
      }
    })
  })
})
