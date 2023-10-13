/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../base'
import { debugConsole } from '@/utils/debugging'

export default App.controller('AnnualUpgradeController', [
  '$scope',
  '$http',
  function ($scope, $http) {
    const MESSAGES_URL = '/user/subscription/upgrade-annual'

    $scope.upgradeComplete = false
    const savings = {
      student: '19.2',
      collaborator: '36',
    }
    $scope.$watch($scope.planName, function () {
      $scope.yearlySaving = savings[$scope.planName]
      if ($scope.planName === 'annual') {
        return ($scope.upgradeComplete = true)
      }
    })
    return ($scope.completeAnnualUpgrade = function () {
      const body = {
        planName: $scope.planName,
        _csrf: window.csrfToken,
      }

      $scope.inflight = true

      return $http
        .post(MESSAGES_URL, body)
        .then(() => ($scope.upgradeComplete = true))
        .catch(err =>
          debugConsole.error('something went wrong changing plan', err)
        )
    })
  },
])
