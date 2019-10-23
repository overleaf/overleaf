define(['base'], App => {
  App.controller('OwnershipTransferConfirmModalController', function(
    $scope,
    $window,
    $modalInstance,
    projectMembers
  ) {
    $scope.state = {
      inflight: false,
      error: false
    }

    $scope.confirm = function() {
      const userId = $scope.member._id
      transferOwnership(userId)
    }

    $scope.cancel = function() {
      $modalInstance.dismiss()
    }

    function transferOwnership(userId) {
      $scope.state.inflight = true
      $scope.state.error = false
      projectMembers
        .transferOwnership(userId)
        .then(() => {
          $scope.state.inflight = false
          $scope.state.error = false
          $window.location.reload()
        })
        .catch(() => {
          $scope.state.inflight = false
          $scope.state.error = true
        })
    }
  })
})
