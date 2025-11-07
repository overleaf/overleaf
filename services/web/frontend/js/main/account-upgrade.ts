import * as eventTracking from '../infrastructure/event-tracking'

export function startFreeTrial(
  source: string,
  variant?: string,
  segmentation?: eventTracking.Segmentation,
  extraSearchParams?: Record<string, string>,
  shouldNavigate: boolean = true
) {
  const eventSegmentation: Record<string, string> = {
    'paywall-type': source,
    ...segmentation,
  }
  if (variant) {
    eventSegmentation.variant = variant
  }

  eventTracking.send('subscription-funnel', 'upgraded-free-trial', source)
  eventTracking.sendMB('paywall-click', eventSegmentation)

  if (shouldNavigate) {
    const searchParams = new URLSearchParams({
      itm_campaign: source,
      ...extraSearchParams,
    })

    window.open(
      `/user/subscription/choose-your-plan?${searchParams.toString()}`
    )
  }
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
