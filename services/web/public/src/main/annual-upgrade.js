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
  App.controller('AnnualUpgradeController', function($scope, $http, $modal) {
    const MESSAGES_URL = '/user/subscription/upgrade-annual'

    $scope.upgradeComplete = false
    const savings = {
      student: '19.2',
      collaborator: '36'
    }
    $scope.$watch($scope.planName, function() {
      $scope.yearlySaving = savings[$scope.planName]
      if ($scope.planName === 'annual') {
        return ($scope.upgradeComplete = true)
      }
    })
    return ($scope.completeAnnualUpgrade = function() {
      const body = {
        planName: $scope.planName,
        _csrf: window.csrfToken
      }

      $scope.inflight = true

      return $http
        .post(MESSAGES_URL, body)
        .then(() => ($scope.upgradeComplete = true))
        .catch(() => console.log('something went wrong changing plan'))
    })
  }))
