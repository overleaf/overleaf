/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('GroupPlanContactController', function($scope, $modal, $http) {
    $scope.form = {}
    $scope.sent = false
    $scope.sending = false
    $scope.error = false
    return ($scope.contactUs = function() {
      if ($scope.form.email == null) {
        console.log('email not set')
        return
      }
      $scope.sending = true
      const ticketNumber = Math.floor((1 + Math.random()) * 0x10000).toString(
        32
      )
      const data = {
        _csrf: window.csrfToken,
        name: $scope.form.name || $scope.form.email,
        email: $scope.form.email,
        labels: `${$scope.form.source} accounts`,
        message: 'Please contact me with more details',
        subject: `${$scope.form.name} - Group Enquiry - ${
          $scope.form.position
        } - ${$scope.form.university}`,
        inbox: 'accounts'
      }

      const request = $http.post('/support', data)

      request.catch(function() {
        $scope.error = true
        return $scope.$apply()
      })

      return request.then(function(response) {
        $scope.sent = true
        eventTracking.send(
          'subscription-funnel',
          'plans-page',
          'group-inquiry-sent'
        )
        $scope.error = response.status !== 200
        return $scope.$apply()
      })
    })
  }))
