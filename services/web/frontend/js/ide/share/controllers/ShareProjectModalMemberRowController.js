define(['base'], App => {
  App.controller('ShareProjectModalMemberRowController', function(
    $scope,
    $modal,
    projectMembers
  ) {
    $scope.form = {
      privileges: $scope.member.privileges,

      isModified() {
        return this.privileges !== $scope.member.privileges
      },

      submit() {
        const userId = $scope.member._id
        const privilegeLevel = $scope.form.privileges
        if (privilegeLevel === 'owner') {
          openOwnershipTransferConfirmModal(userId)
        } else {
          setPrivilegeLevel(userId, privilegeLevel)
        }
      },

      reset() {
        this.privileges = $scope.member.privileges
        $scope.clearError()
      }
    }

    function setPrivilegeLevel(userId, privilegeLevel) {
      $scope.monitorRequest(
        projectMembers
          .setMemberPrivilegeLevel(userId, privilegeLevel)
          .then(() => {
            $scope.member.privileges = privilegeLevel
          })
      )
    }

    function openOwnershipTransferConfirmModal(userId) {
      $modal.open({
        templateUrl: 'ownershipTransferConfirmTemplate',
        controller: 'OwnershipTransferConfirmModalController',
        scope: $scope
      })
    }
  })
})
