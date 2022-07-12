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
import { updateLinkTargets } from '../plans'

// We need this mutable variable because the group tab only have annual.
// There's some difference between the monthly and annual UI
// and since monthly-annual switch is disabled for the group tab,
// we need to introduce a new variable to store the information
let currentMonthlyAnnualSwitchValue = 'monthly'

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

    el.querySelector('a').addEventListener('click', function (e) {
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
    const isAnnualPricing = document.querySelector(
      '[data-ol-plans-v2-m-a-switch] input[type="checkbox"]'
    ).checked

    if (isAnnualPricing) {
      currentMonthlyAnnualSwitchValue = 'annual'
    } else {
      currentMonthlyAnnualSwitchValue = 'monthly'
    }

    switchMonthlyAnnual(currentMonthlyAnnualSwitchValue)
  })

setUpTabSwitching()
setUpGroupPlanPricingChange()
setUpMonthlyAnnualSwitching()
setUpGroupSubscriptionButtonAction()
setUpStickyHeaderObserver()
updateLinkTargets()

selectViewFromHash()
window.addEventListener('hashchange', selectViewFromHash)
