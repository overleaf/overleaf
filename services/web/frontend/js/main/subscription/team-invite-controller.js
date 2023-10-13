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
import App from '../../base'
import getMeta from '../../utils/meta'
import { debugConsole } from '@/utils/debugging'

export default App.controller('TeamInviteController', [
  '$scope',
  '$http',
  function ($scope, $http) {
    $scope.inflight = false

    const hideJoinSubscription = getMeta('ol-cannot-join-subscription')
    const hasIndividualRecurlySubscription = getMeta(
      'ol-hasIndividualRecurlySubscription'
    )

    if (hideJoinSubscription) {
      $scope.view = 'restrictedByManagedGroup'
    } else if (hasIndividualRecurlySubscription) {
      $scope.view = 'hasIndividualRecurlySubscription'
    } else {
      $scope.view = 'teamInvite'
    }

    $scope.keepPersonalSubscription = () => ($scope.view = 'teamInvite')

    $scope.cancelPersonalSubscription = function () {
      $scope.inflight = true
      const request = $http.post('/user/subscription/cancel', {
        _csrf: window.csrfToken,
      })
      request.then(function () {
        $scope.inflight = false
        return ($scope.view = 'teamInvite')
      })
      return request.catch(() => {
        $scope.inflight = false
        $scope.cancel_error = true
        debugConsole.error('the request failed')
      })
    }

    return ($scope.joinTeam = function () {
      $scope.inflight = true
      const inviteToken = getMeta('ol-inviteToken')
      const request = $http.put(`/subscription/invites/${inviteToken}/`, {
        _csrf: window.csrfToken,
      })
      request.then(function (response) {
        const { status } = response
        $scope.inflight = false
        $scope.view = 'inviteAccepted'
        if (status !== 200) {
          // assume request worked
          return ($scope.requestSent = false)
        }
      })
      return request.catch(() => debugConsole.error('the request failed'))
    })
  },
])
