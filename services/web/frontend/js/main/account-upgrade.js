import * as eventTracking from '../infrastructure/event-tracking'

function startFreeTrial(source, version, $scope, variant) {
  const eventSegmentation = { 'paywall-type': source }
  if (variant) {
    eventSegmentation.variant = variant
  }

  eventTracking.send('subscription-funnel', 'upgraded-free-trial', source)
  eventTracking.sendMB('paywall-click', eventSegmentation)

  const searchParams = new URLSearchParams({
    itm_campaign: source,
  })

  if (version) {
    searchParams.set('itm_content', version)
  }

  if ($scope) {
    $scope.startedFreeTrial = true
  }

  window.open(`/user/subscription/choose-your-plan?${searchParams.toString()}`)
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

function paywallPrompt(source) {
  eventTracking.sendMB('paywall-prompt', { 'paywall-type': source })
}

export { startFreeTrial, upgradePlan, paywallPrompt }
