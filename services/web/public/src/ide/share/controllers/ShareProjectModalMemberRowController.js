define(['base'], App => {
  App.controller('ShareProjectModalMemberRowController', function(
    $scope,
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
        $scope.monitorRequest(
          projectMembers
            .setMemberPrivilegeLevel(userId, privilegeLevel)
            .then(() => {
              $scope.member.privileges = privilegeLevel
            })
        )
      },

      reset() {
        this.privileges = $scope.member.privileges
        $scope.clearError()
      }
    }
  })
})
