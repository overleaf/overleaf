function startFreeTrial(source, version, $scope, eventTracking) {
  const plan = 'collaborator_free_trial_7_days'

  const w = window.open()
  const go = function () {
    let url
    if (typeof ga === 'function') {
      ga('send', 'event', 'subscription-funnel', 'upgraded-free-trial', source)
    }
    url = `/user/subscription/new?planCode=${plan}&ssp=true`
    url = `${url}&itm_campaign=${source}`
    if (version) {
      url = `${url}&itm_content=${version}`
    }

    if ($scope) {
      $scope.startedFreeTrial = true
    }

    if (eventTracking) {
      eventTracking.sendMB('subscription-start-trial', { source, plan })
    }

    w.location = url
  }

  go()
}

function upgradePlan(source, $scope) {
  const w = window.open()
  const go = function () {
    if (typeof ga === 'function') {
      ga('send', 'event', 'subscription-funnel', 'upgraded-plan', source)
    }
    const url = '/user/subscription'

    if ($scope) {
      $scope.startedFreeTrial = true
    }

    w.location = url
  }

  go()
}

export { startFreeTrial, upgradePlan }
