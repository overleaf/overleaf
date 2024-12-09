import { sendMB } from '@/infrastructure/event-tracking'
import { getSplitTestVariant } from '@/utils/splitTestUtils'
import getMeta from '@/utils/meta'

export function sendPlansViewEvent() {
  document.addEventListener(
    'DOMContentLoaded',
    function () {
      const currency = getMeta('ol-recommendedCurrency')
      const countryCode = getMeta('ol-countryCode')

      const groupTabImprovementsVariant = getSplitTestVariant(
        'group-tab-improvements'
      )

      const websiteRedesignPlansTestVariant = getMeta(
        'ol-websiteRedesignPlansVariant'
      )

      const periodToggleTestVariant = getSplitTestVariant(
        'period-toggle-improvements'
      )

      const device = window.matchMedia('(max-width: 767px)').matches
        ? 'mobile'
        : 'desktop'

      const queryParams = new URLSearchParams(window.location.search)
      const planTabParam = queryParams.get('plan')

      const plansPageViewSegmentation = {
        currency,
        countryCode,
        device,
        'website-redesign-plans': websiteRedesignPlansTestVariant,
        'group-tab-improvements': groupTabImprovementsVariant,
        plan: planTabParam,
        'period-toggle-improvements': periodToggleTestVariant,
      }

      const isPlansPage = window.location.href.includes(
        'user/subscription/plans'
      )
      const isInterstitialPaymentPage = window.location.href.includes(
        'user/subscription/choose-your-plan'
      )

      if (isPlansPage) {
        sendMB('plans-page-view', plansPageViewSegmentation)
      } else if (isInterstitialPaymentPage) {
        sendMB('paywall-plans-page-view', plansPageViewSegmentation)
      }
    },
    { once: true }
  )
}
