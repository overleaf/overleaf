define(['base'], App =>
  App.controller('UserOauthController', function($http, $scope, $q) {
    const _reset = function() {
      $scope.ui = {
        hasError: false,
        errorMessage: ''
      }
      $scope.providers = window.oauthProviders
      $scope.thirdPartyIds = window.thirdPartyIds
    }
    const _unlinkError = (providerId, err) => {
      $scope.providers[providerId].ui.hasError = true
      $scope.providers[providerId].ui.errorMessage =
        err && err.data && err.data.message ? err.data.message : 'error'
    }

    $scope.unlink = providerId => {
      if (window.ExposedSettings.isOverleaf) {
        // UI
        $scope.providers[providerId].ui = {
          hasError: false,
          isProcessing: true
        }
        // Data for update
        const data = {
          _csrf: window.csrfToken,
          link: false,
          providerId
        }
        $http
          .post('/user/oauth-unlink', data)
          .catch(error => {
            $scope.providers[providerId].ui.isProcessing = false
            _unlinkError(providerId, error)
          })
          .then(response => {
            $scope.providers[providerId].ui.isProcessing = false
            if (response.status === 200) {
              $scope.thirdPartyIds[providerId] = null
            } else {
              _unlinkError(providerId, response)
            }
          })
      }
    }

    _reset()
  }))
