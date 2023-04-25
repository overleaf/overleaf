import '../../../../marketing'

import * as eventTracking from '../../../../infrastructure/event-tracking'
import { setUpStickyHeaderObserver } from './plans-v2-sticky-header'
import {
  setUpMonthlyAnnualSwitching,
  switchMonthlyAnnual,
  toggleMonthlyAnnualSwitching,
} from './plans-v2-m-a-switch'
import {
  changeGroupPlanModalEducationalDiscount,
  changeGroupPlanModalNumberOfLicenses,
  updateMainGroupPlanPricing,
} from './plans-v2-group-plan'
import { setUpGroupSubscriptionButtonAction } from './plans-v2-subscription-button'
import getMeta from '../../../../utils/meta'

const currentCurrencyCode = getMeta('ol-recommendedCurrency')

function setUpSubscriptionTracking(linkEl) {
  linkEl.addEventListener('click', function () {
    const plan =
      linkEl.getAttribute('data-ol-tracking-plan') ||
      linkEl.getAttribute('data-ol-start-new-subscription')

    const location = linkEl.getAttribute('data-ol-location')
    const period = linkEl.getAttribute('data-ol-item-view')

    const DEFAULT_EVENT_TRACKING_KEY = 'plans-page-click'

    const eventTrackingKey =
      linkEl.getAttribute('data-ol-event-tracking-key') ||
      DEFAULT_EVENT_TRACKING_KEY

    const eventTrackingSegmentation = {
      button: plan,
      location,
      'billing-period': period,
    }

    eventTracking.sendMB('plans-page-start-trial') // deprecated by plans-page-click
    eventTracking.sendMB(eventTrackingKey, eventTrackingSegmentation)
  })
}

const searchParams = new URLSearchParams(window.location.search)

export function updateLinkTargets() {
  document.querySelectorAll('[data-ol-start-new-subscription]').forEach(el => {
    if (el.hasAttribute('data-ol-has-custom-href')) return

    const plan = el.getAttribute('data-ol-start-new-subscription')
    const view = el.getAttribute('data-ol-item-view')
    const suffix = view === 'annual' ? `-annual` : `_free_trial_7_days`
    const planCode = `${plan}${suffix}`

    const location = el.getAttribute('data-ol-location')
    const itmCampaign = searchParams.get('itm_campaign') || 'plans'
    const itmContent =
      itmCampaign === 'plans' ? location : searchParams.get('itm_content')

    const queryString = new URLSearchParams({
      planCode,
      currency: currentCurrencyCode,
      itm_campaign: itmCampaign,
    })

    if (itmContent) {
      queryString.set('itm_content', itmContent)
    }

    if (searchParams.get('itm_referrer')) {
      queryString.set('itm_referrer', searchParams.get('itm_referrer'))
    }

    el.href = `/user/subscription/new?${queryString.toString()}`
  })
}

// We need this mutable variable because the group tab only have annual.
// There's some difference between the monthly and annual UI
// and since monthly-annual switch is disabled for the group tab,
// we need to introduce a new variable to store the information
let currentMonthlyAnnualSwitchValue = 'annual'

function selectTab(viewTab) {
  document.querySelectorAll('[data-ol-plans-v2-view-tab]').forEach(el => {
    el.classList.toggle(
      'active',
      el.getAttribute('data-ol-plans-v2-view-tab') === viewTab
    )
  })

  document.querySelectorAll('[data-ol-plans-v2-view]').forEach(el => {
    el.hidden = el.getAttribute('data-ol-plans-v2-view') !== viewTab
  })

  document.querySelector('[data-ol-plans-v2-m-a-tooltip]').hidden =
    viewTab === 'group'
  document.querySelector('[data-ol-plans-v2-license-picker-container]').hidden =
    viewTab !== 'group'

  document
    .querySelector('[data-ol-plans-v2-m-a-switch-container]')
    .setAttribute('data-ol-current-view', viewTab)

  // group tab is special because group plan only has annual value
  // so we need to perform some UI changes whenever user click the group tab
  if (viewTab === 'group') {
    updateMainGroupPlanPricing()
    toggleMonthlyAnnualSwitching(viewTab, 'annual')
  } else {
    toggleMonthlyAnnualSwitching(viewTab, currentMonthlyAnnualSwitchValue)
  }

  toggleUniversityInfo(viewTab)
}

function setUpTabSwitching() {
  document.querySelectorAll('[data-ol-plans-v2-view-tab]').forEach(el => {
    const viewTab = el.getAttribute('data-ol-plans-v2-view-tab')

    el.querySelector('button').addEventListener('click', function (e) {
      e.preventDefault()
      eventTracking.send(
        'subscription-funnel',
        'plans-page',
        `${viewTab}-prices`
      )
      selectTab(viewTab)
    })
  })
}

function setUpGroupPlanPricingChange() {
  document
    .querySelectorAll('[data-ol-plans-v2-license-picker-select]')
    .forEach(el => {
      el.addEventListener('change', () => {
        updateMainGroupPlanPricing()
        changeGroupPlanModalNumberOfLicenses()
      })
    })

  document
    .querySelectorAll(
      '[data-ol-plans-v2-license-picker-educational-discount-input]'
    )
    .forEach(el =>
      el.addEventListener('change', () => {
        updateMainGroupPlanPricing()
        changeGroupPlanModalEducationalDiscount()
      })
    )
}

function toggleUniversityInfo(viewTab) {
  const el = document.querySelector('[data-ol-plans-university-info-container]')

  el.hidden = viewTab !== 'student'
}

function selectViewFromHash() {
  try {
    const params = new URLSearchParams(window.location.hash.substring(1))
    const view = params.get('view')
    if (view) {
      // make sure the selected view is valid
      if (document.querySelector(`[data-ol-plans-v2-view-tab="${view}"]`)) {
        // set annual as the default
        currentMonthlyAnnualSwitchValue = 'annual'
        selectTab(view)
        // clear the hash so it doesn't persist when switching plans
        window.location.hash = ''
      }
    }
  } catch {
    // do nothing
  }
}

document
  .querySelector('[data-ol-plans-v2-m-a-switch]')
  .addEventListener('click', () => {
    const isMonthlyPricing = document.querySelector(
      '[data-ol-plans-v2-m-a-switch] input[type="checkbox"]'
    ).checked

    if (isMonthlyPricing) {
      currentMonthlyAnnualSwitchValue = 'monthly'
    } else {
      currentMonthlyAnnualSwitchValue = 'annual'
    }

    switchMonthlyAnnual(currentMonthlyAnnualSwitchValue)
  })

document
  .querySelectorAll('[data-ol-start-new-subscription]')
  .forEach(setUpSubscriptionTracking)

setUpTabSwitching()
setUpGroupPlanPricingChange()
setUpMonthlyAnnualSwitching()
setUpGroupSubscriptionButtonAction()
setUpStickyHeaderObserver()
updateLinkTargets()

selectViewFromHash()
window.addEventListener('hashchange', selectViewFromHash)
