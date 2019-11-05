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
  App.controller('ClearSessionsController', function($scope, $http) {
    $scope.state = {
      otherSessions: window.otherSessions,
      error: false,
      success: false
    }

    return ($scope.clearSessions = function() {
      console.log('>> clearing all sessions')
      return $http({
        method: 'POST',
        url: '/user/sessions/clear',
        headers: { 'X-CSRF-Token': window.csrfToken }
      })
        .then(function() {
          $scope.state.otherSessions = []
          $scope.state.error = false
          return ($scope.state.success = true)
        })
        .catch(() => ($scope.state.error = true))
    })
  }))
