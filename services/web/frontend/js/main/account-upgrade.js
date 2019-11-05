define(['base'], App =>
  App.controller('FreeTrialModalController', function($scope, eventTracking) {
    $scope.buttonClass = 'btn-primary'

    $scope.startFreeTrial = function(source, version) {
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
        url = `/user/subscription/new?planCode=${plan}&ssp=true`
        url = `${url}&itm_campaign=${source}`
        if (version) {
          url = `${url}&itm_content=${version}`
        }

        $scope.startedFreeTrial = true

        eventTracking.sendMB('subscription-start-trial', { source, plan })

        w.location = url
      }

      go()
    }
  }))
