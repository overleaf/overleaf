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
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('FreeTrialModalController', function($scope, event_tracking) {
    $scope.buttonClass = 'btn-primary'

    return ($scope.startFreeTrial = function(source, couponCode) {
      const plan = 'collaborator_free_trial_7_days'

      const w = window.open()
      const go = function() {
        let url
        if (typeof ga === 'function') {
          ga(
            'send',
            'event',
            'subscription-funnel',
            'upgraded-free-trial',
            source
          )
        }
        if (window.useV2TrialUrl) {
          url = '/user/trial'
        } else {
          url = `/user/subscription/new?planCode=${plan}&ssp=true`
          if (couponCode != null) {
            url = `${url}&cc=${couponCode}`
          }
        }
        $scope.startedFreeTrial = true

        event_tracking.sendMB('subscription-start-trial', { source, plan })

        return (w.location = url)
      }

      return go()
    })
  }))
