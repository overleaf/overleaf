import * as eventTracking from '../infrastructure/event-tracking'
import getMeta from '../utils/meta'

const interstitialPaymentAfterPaywallVariant =
  getMeta('ol-splitTestVariants')?.['interstitial-payment-from-paywall'] ??
  'default'

function startFreeTrial(source, version, $scope) {
  const plan = 'collaborator_free_trial_7_days'

  const w = window.open()
  const go = function () {
    let url
    if (typeof ga === 'function') {
      ga('send', 'event', 'subscription-funnel', 'upgraded-free-trial', source)
    }
    eventTracking.sendMB('paywall-click', { 'paywall-type': source })

    if (interstitialPaymentAfterPaywallVariant === 'active') {
      url = '/user/subscription/choose-your-plan'
    } else {
      url = `/user/subscription/new?planCode=${plan}&ssp=true`
    }

    url = `${url}&itm_campaign=${source}`
    if (version) {
      url = `${url}&itm_content=${version}`
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
