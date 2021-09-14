import _ from 'lodash'
import App from '../../../base'
import getMeta from '../../../utils/meta'

export default App.controller(
  'UserAffiliationsReconfirmController',
  function ($scope, $http, $window) {
    const samlInitPath = ExposedSettings.samlInitPath
    $scope.reconfirm = {}
    $scope.ui = $scope.ui || {} // $scope.ui inherited on settings page
    $scope.userEmails = getMeta('ol-userEmails')
    $scope.reconfirmedViaSAML = getMeta('ol-reconfirmedViaSAML')

    // For portals:
    const portalAffiliation = getMeta('ol-portalAffiliation')
    if (portalAffiliation) {
      $scope.portalInReconfirmNotificationPeriod =
        portalAffiliation && portalAffiliation.inReconfirmNotificationPeriod
      $scope.userEmail = $scope.portalInReconfirmNotificationPeriod // mixin to show notification uses userEmail
    }

    // For settings page:
    $scope.reconfirmationRemoveEmail = getMeta('ol-reconfirmationRemoveEmail')

    // For dashboard:
    $scope.allInReconfirmNotificationPeriods = getMeta(
      'ol-allInReconfirmNotificationPeriods'
    )

    function sendReconfirmEmail(email) {
      $scope.ui.hasError = false
      $scope.ui.isMakingRequest = true
      $http
        .post('/user/emails/send-reconfirmation', {
          email,
          _csrf: window.csrfToken,
        })
        .then(() => {
          $scope.reconfirm[email].reconfirmationSent = true
        })
        .catch(_ => {
          $scope.ui.hasError = true
        })
        .finally(() => ($scope.ui.isMakingRequest = false))
    }

    $scope.requestReconfirmation = function (obj, userEmail) {
      const email = userEmail.email
      // For the settings page, disable other parts of affiliation UI
      $scope.ui.isMakingRequest = true
      $scope.ui.isProcessing = true
      // create UI scope for requested email
      $scope.reconfirm[email] = $scope.reconfirm[email] || {} // keep existing scope for resend email requests

      const location = obj.currentTarget.getAttribute('data-location')
      const institutionId = _.get(userEmail, [
        'affiliation',
        'institution',
        'id',
      ])
      const ssoEnabled = _.get(userEmail, [
        'affiliation',
        'institution',
        'ssoEnabled',
      ])

      if (ssoEnabled) {
        $window.location.href = `${samlInitPath}?university_id=${institutionId}&reconfirm=${location}`
      } else {
        sendReconfirmEmail(email)
      }
    }
  }
)
