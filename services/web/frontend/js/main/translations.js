import App from '../base'

App.controller('TranslationsPopupController', function(
  $scope,
  ipCookie,
  localStorage
) {
  function getStoredDismissal() {
    let localStore = localStorage('hide-i18n-notification')

    if (localStore === null) {
      // Not stored in localStorage, check cookie
      let cookieStore = ipCookie('hidei18nNotification')

      // If stored in cookie, set on localStorage for forwards compat
      if (cookieStore) {
        localStorage('hide-i18n-notification', cookieStore)
        ipCookie.remove('hidei18nNotification')
      }

      return cookieStore
    }

    return localStore
  }

  $scope.hidei18nNotification = getStoredDismissal()

  $scope.dismiss = function() {
    localStorage('hide-i18n-notification', true)
    $scope.hidei18nNotification = true
  }
})
