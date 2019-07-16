define(['base'], function(App) {
  return App.factory('UserOauthDataService', function($http) {
    const getUserOauthV1 = () => {
      if (window.ExposedSettings.isOverleaf) {
        return $http.get('/user/v1-oauth-uids').then(response => {
          return response.data
        })
      } else {
        return {}
      }
    }

    return {
      getUserOauthV1
    }
  })
})
