/* eslint-disable
    camelcase,
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
  App.controller('DomainSubscriptionJoinController', function($scope, $http) {
    $scope.inflight = false

    if (has_personal_subscription) {
      $scope.view = 'personalSubscription'
    } else {
      $scope.view = 'domainSubscriptionJoin'
    }

    $scope.keepPersonalSubscription = () =>
      ($scope.view = 'domainSubscriptionJoin')

    $scope.cancelSubscription = function() {
      $scope.inflight = true
      const request = $http.post('/user/subscription/cancel', {
        _csrf: window.csrfToken
      })
      request.then(function() {
        $scope.inflight = false
        return ($scope.view = 'domainSubscriptionJoin')
      })
      return request.catch(() => console.log('the request failed'))
    }

    return ($scope.joinGroup = function() {
      $scope.view = 'requestSent'
      $scope.inflight = true
      const request = $http.post('/user/subscription/domain/join', {
        _csrf: window.csrfToken
      })
      request.then(function(response) {
        const { status } = response
        $scope.inflight = false
        if (status !== 200) {
          // assume request worked
          return ($scope.requestSent = false)
        }
      })
      return request.catch(() => console.log('the request failed'))
    })
  }))
