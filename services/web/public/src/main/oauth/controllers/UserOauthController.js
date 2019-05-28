define(['base'], App =>
  App.controller('UserOauthController', [
    '$http',
    '$scope',
    '$q',
    '_',
    'UserOauthDataService',
    function($http, $scope, $q, _, UserOauthDataService) {
      const _monitorRequest = function(promise) {
        $scope.ui.hasError = false
        $scope.ui.isLoadingV1Ids = true
        promise
          .catch(response => {
            $scope.ui.hasError = true
            $scope.ui.errorMessage =
              response && response.data && response.data.message
                ? response.data.message
                : 'error'
          })
          .finally(() => {
            $scope.ui.isLoadingV1Ids = false
          })
        return promise
      }
      const _reset = function() {
        $scope.ui = {
          hasError: false,
          errorMessage: '',
          isLoadingV1Ids: false
        }
        $scope.providers = window.oauthProviders
        $scope.thirdPartyIds = window.thirdPartyIds
        // $scope.v2ThirdPartyIds can be removed post user-c11n
        // until v1 is authoritative we will use v1 SSO data for providers
        // except collabratec, which will only write to v2.
        // post user-c11n, oauthFallback setting will be removed and
        // we will only use data from v2
        $scope.v2ThirdPartyIds = window.thirdPartyIds
      }
      const _getUserV1OauthProviders = () => {
        $scope.ui.isLoadingV1Ids = true
        return _monitorRequest(UserOauthDataService.getUserOauthV1()).then(
          thirdPartyIds => {
            $scope.thirdPartyIds = thirdPartyIds
          }
        )
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
                // v2thirdPartyIds below can be removed post user c11n
                $scope.v2ThirdPartyIds[providerId] = null
              } else {
                _unlinkError(providerId, response)
              }
            })
        }
      }

      _reset()
      if (window.oauthFallback) {
        _getUserV1OauthProviders()
      }
    }
  ]))
