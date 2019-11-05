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
  App.controller('TeamInviteController', function($scope, $http) {
    $scope.inflight = false

    if (hasIndividualRecurlySubscription) {
      $scope.view = 'hasIndividualRecurlySubscription'
    } else {
      $scope.view = 'teamInvite'
    }

    $scope.keepPersonalSubscription = () => ($scope.view = 'teamInvite')

    $scope.cancelPersonalSubscription = function() {
      $scope.inflight = true
      const request = $http.post('/user/subscription/cancel', {
        _csrf: window.csrfToken
      })
      request.then(function() {
        $scope.inflight = false
        return ($scope.view = 'teamInvite')
      })
      return request.catch(() => {
        $scope.inflight = false
        $scope.cancel_error = true
        console.log('the request failed')
      })
    }

    return ($scope.joinTeam = function() {
      $scope.inflight = true
      const request = $http.put(
        `/subscription/invites/${window.inviteToken}/`,
        { _csrf: window.csrfToken }
      )
      request.then(function(response) {
        const { status } = response
        $scope.inflight = false
        $scope.view = 'inviteAccepted'
        if (status !== 200) {
          // assume request worked
          return ($scope.requestSent = false)
        }
      })
      return request.catch(() => console.log('the request failed'))
    })
  }))
