/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('ShareController', function(
    $scope,
    $modal,
    ide,
    projectInvites,
    projectMembers,
    event_tracking
  ) {
    $scope.openShareProjectModal = function(isAdmin) {
      $scope.isAdmin = isAdmin
      event_tracking.sendMBOnce('ide-open-share-modal-once')

      return $modal.open({
        templateUrl: 'shareProjectModalTemplate',
        controller: 'ShareProjectModalController',
        scope: $scope
      })
    }

    ide.socket.on('project:tokens:changed', data => {
      if (data.tokens != null) {
        ide.$scope.project.tokens = data.tokens
        return $scope.$digest()
      }
    })

    return ide.socket.on('project:membership:changed', data => {
      if (data.members) {
        projectMembers
          .getMembers()
          .then(response => {
            ;({ data } = response)
            if (data.members) {
              return ($scope.project.members = data.members)
            }
          })
          .catch(() => {
            return console.error('Error fetching members for project')
          })
      }
      if (data.invites) {
        return projectInvites
          .getInvites()
          .then(response => {
            ;({ data } = response)
            if (data.invites) {
              return ($scope.project.invites = data.invites)
            }
          })
          .catch(() => {
            return console.error('Error fetching invites for project')
          })
      }
    })
  }))
