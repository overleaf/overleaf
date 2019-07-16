define(['base'], App =>
  App.controller('UserOauthController', function(
    $http,
    $scope,
    $q,
    _,
    UserOauthDataService
  ) {
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
      // until oauthUseV2=true, we will use OAuth data via v1 DB,
      // except for Collabratec, which is only writing to the v2 DB.
      // $scope.v2ThirdPartyIds is required for Collabratec,
      // and only until v2 is authoritative. Though, we should leave this
      // until we stop double writes, in case we need to flip.
      // Double writes for OAuth will stop when oauthFallback=false
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
    if (!window.oauthUseV2) {
      _getUserV1OauthProviders()
    }
  }))
