define(['base'], App =>
  App.controller('UserOauthController', [
    '$scope',
    '$q',
    '_',
    'UserOauthDataService',
    function($scope, $q, _, UserOauthDataService) {
      $scope.providers = [
        { key: 'google', name: 'Google' },
        { key: 'orcid', name: 'Orcid' },
        { key: 'twitter', name: 'Twitter' }
      ]
      const _monitorRequest = function(promise) {
        $scope.ui.hasError = false
        $scope.ui.isLoadingProviders = true
        promise
          .catch(response => {
            $scope.ui.hasError = true
            $scope.ui.errorMessage =
              response && response.data && response.data.message
                ? response.data.message
                : 'error'
          })
          .finally(() => {
            $scope.ui.isLoadingProviders = false
          })
        return promise
      }
      const _reset = function() {
        $scope.ui = {
          hasError: false,
          errorMessage: '',
          isLoadingProviders: false
        }
        $scope.userProviders = {}
      }
      const _getUserV1OauthProviders = () => {
        $scope.ui.isLoadingProviders = true
        return _monitorRequest(UserOauthDataService.getUserOauthV1()).then(
          userProviders => {
            $scope.userProviders = userProviders
          }
        )
      }
      _reset()
      return _getUserV1OauthProviders()
    }
  ]))
