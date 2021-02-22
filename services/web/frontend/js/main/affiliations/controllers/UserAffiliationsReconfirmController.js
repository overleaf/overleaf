import _ from 'lodash'
import App from '../../../base'

export default App.controller('UserAffiliationsReconfirmController', function(
  $scope,
  UserAffiliationsDataService,
  $window
) {
  $scope.reconfirm = {}
  // For portals:
  $scope.userEmails = window.data.userEmails
  // For settings page:
  $scope.ui = $scope.ui || {} // $scope.ui inherited on settings page
  // For dashboard:
  $scope.allInReconfirmNotificationPeriods =
    window.data.allInReconfirmNotificationPeriods

  function sendReconfirmEmail(email) {
    $scope.ui.hasError = false
    $scope.ui.isMakingRequest = true
    UserAffiliationsDataService.resendConfirmationEmail(email)
      .then(() => {
        $scope.reconfirm[email].reconfirmationSent = true
      })
      .catch(error => {
        $scope.ui.hasError = true
      })
      .finally(() => ($scope.ui.isMakingRequest = false))
  }

  $scope.reconfirmationRemoveEmail = $window.data.reconfirmationRemoveEmail
  $scope.reconfirmedViaSAML = $window.data.reconfirmedViaSAML

  $scope.requestReconfirmation = function(obj, userEmail) {
    const email = userEmail.email
    // For the settings page, disable other parts of affiliation UI
    $scope.ui.isMakingRequest = true
    $scope.ui.isProcessing = true
    // create UI scope for requested email
    $scope.reconfirm[email] = $scope.reconfirm[email] || {} // keep existing scope for resend email requests

    const location = obj.currentTarget.getAttribute('data-location')
    const institutionId = _.get(userEmail, ['affiliation', 'institution', 'id'])
    const ssoEnabled = _.get(userEmail, [
      'affiliation',
      'institution',
      'ssoEnabled'
    ])

    if (ssoEnabled) {
      $window.location.href = `${$scope.samlInitPath}?university_id=${institutionId}&reconfirm=${location}`
    } else {
      sendReconfirmEmail(email)
    }
  }
})
