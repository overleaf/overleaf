import * as eventTracking from '../infrastructure/event-tracking'

export function startFreeTrial(source: string, variant?: string) {
  const eventSegmentation: Record<string, string> = { 'paywall-type': source }
  if (variant) {
    eventSegmentation.variant = variant
  }

  eventTracking.send('subscription-funnel', 'upgraded-free-trial', source)
  eventTracking.sendMB('paywall-click', eventSegmentation)

  const searchParams = new URLSearchParams({
    itm_campaign: source,
  })

  window.open(`/user/subscription/choose-your-plan?${searchParams.toString()}`)
}

export function upgradePlan(source: string) {
  const openedWindow = window.open()

  if (typeof window.ga === 'function') {
    window.ga('send', 'event', 'subscription-funnel', 'upgraded-plan', source)
  }

  if (openedWindow) {
    openedWindow.location = '/user/subscription'
  }
}
