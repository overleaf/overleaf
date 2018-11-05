/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('TranslationsPopupController', function($scope, ipCookie) {
    $scope.hidei18nNotification = ipCookie('hidei18nNotification')

    return ($scope.dismiss = function() {
      ipCookie('hidei18nNotification', true, { expires: 180 })
      return ($scope.hidei18nNotification = ipCookie('hidei18nNotification'))
    })
  }))
