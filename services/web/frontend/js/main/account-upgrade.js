import * as eventTracking from '../infrastructure/event-tracking'
import getMeta from '../utils/meta'

const interstitialPaymentAfterPaywallVariant =
  getMeta('ol-splitTestVariants')?.['interstitial-payment-from-paywall'] ??
  'default'

function startFreeTrial(source, version, $scope) {
  const plan = 'collaborator_free_trial_7_days'

  const w = window.open()
  const go = function () {
    if (typeof ga === 'function') {
      ga('send', 'event', 'subscription-funnel', 'upgraded-free-trial', source)
    }
    eventTracking.sendMB('paywall-click', { 'paywall-type': source })

    const searchParams = new URLSearchParams({ itm_campaign: source })

    if (version) {
      searchParams.set('itm_content', version)
    }

    let url
    if (interstitialPaymentAfterPaywallVariant === 'active') {
      url = `/user/subscription/choose-your-plan?${searchParams.toString()}`
    } else {
      searchParams.set('ssp', 'true')
      searchParams.set('planCode', plan)
      url = `/user/subscription/new?${searchParams.toString()}`
    }

    if ($scope) {
      $scope.startedFreeTrial = true
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

function paywallPrompt(source) {
  eventTracking.sendMB('paywall-prompt', { 'paywall-type': source })
}

export { startFreeTrial, upgradePlan, paywallPrompt }
