define(['base'], function(App) {
  App.controller('AccountSettingsController', function(
    $scope,
    $http,
    $modal,
    // eslint-disable-next-line camelcase
    event_tracking,
    UserAffiliationsDataService
  ) {
    $scope.subscribed = true

    $scope.unsubscribe = function() {
      $scope.unsubscribing = true
      return $http({
        method: 'DELETE',
        url: '/user/newsletter/unsubscribe',
        headers: {
          'X-CSRF-Token': window.csrfToken
        }
      })
        .then(function() {
          $scope.unsubscribing = false
          $scope.subscribed = false
        })
        .catch(() => ($scope.unsubscribing = true))
    }

    $scope.deleteAccount = function() {
      $modal.open({
        templateUrl: 'deleteAccountModalTemplate',
        controller: 'DeleteAccountModalController',
        resolve: {
          userDefaultEmail() {
            return UserAffiliationsDataService.getUserDefaultEmail()
              .then(
                defaultEmailDetails =>
                  (defaultEmailDetails != null
                    ? defaultEmailDetails.email
                    : undefined) || null
              )
              .catch(() => null)
          }
        }
      })
    }

    $scope.upgradeIntegration = service =>
      event_tracking.send('subscription-funnel', 'settings-page', service)
  })

  App.controller('DeleteAccountModalController', function(
    $scope,
    $modalInstance,
    $timeout,
    $http,
    userDefaultEmail
  ) {
    $scope.state = {
      isValid: false,
      deleteText: '',
      password: '',
      confirmV1Purge: false,
      confirmSharelatexDelete: false,
      inflight: false,
      error: null
    }

    $scope.userDefaultEmail = userDefaultEmail

    $modalInstance.opened.then(() =>
      $timeout(() => $scope.$broadcast('open'), 700)
    )

    $scope.checkValidation = () =>
      ($scope.state.isValid =
        userDefaultEmail != null &&
        $scope.state.deleteText.toLowerCase() ===
          userDefaultEmail.toLowerCase() &&
        $scope.state.password.length > 0 &&
        $scope.state.confirmV1Purge &&
        $scope.state.confirmSharelatexDelete)

    $scope.delete = function() {
      $scope.state.inflight = true
      $scope.state.error = null
      return $http({
        method: 'POST',
        url: '/user/delete',
        headers: {
          'X-CSRF-Token': window.csrfToken,
          'Content-Type': 'application/json'
        },
        data: {
          password: $scope.state.password
        },
        disableAutoLoginRedirect: true // we want to handle errors ourselves
      })
        .then(function() {
          $modalInstance.close()
          $scope.state.inflight = false
          $scope.state.error = null
          setTimeout(() => (window.location = '/login'), 1000)
        })
        .catch(function(response) {
          const { data, status } = response
          $scope.state.inflight = false
          if (status === 403) {
            $scope.state.error = { code: 'InvalidCredentialsError' }
          } else if (data.error) {
            $scope.state.error = { code: data.error }
          } else {
            $scope.state.error = { code: 'UserDeletionError' }
          }
        })
    }

    $scope.cancel = () => $modalInstance.dismiss('cancel')
  })
})
