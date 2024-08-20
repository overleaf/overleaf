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
import {
  getViewInfoFromHash,
  handleForStudentsLinkInFooter,
  setHashFromViewTab,
} from './plans-v2-hash'
import { sendPlansViewEvent } from './plans-v2-tracking'
import getMeta from '../../../../utils/meta'

const currentCurrencyCode = getMeta('ol-recommendedCurrency')

function showQuoteForTab(viewTab) {
  // hide/display quote rows
  document.querySelectorAll('.plans-page-quote-row').forEach(quoteRow => {
    const showForPlanTypes = quoteRow.getAttribute('data-ol-show-for-plan-type')
    if (showForPlanTypes?.includes(viewTab)) {
      quoteRow.classList.remove('plans-page-quote-row-hidden')
    } else {
      quoteRow.classList.add('plans-page-quote-row-hidden')
    }
  })
}

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

    const suffix = view === 'annual' ? '-annual' : '_free_trial_7_days'

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
    const tab = el.querySelector('[data-ol-plans-v2-view-tab] button')
    if (tab) {
      const isActive =
        tab.parentElement.getAttribute('data-ol-plans-v2-view-tab') === viewTab
      tab.parentElement.classList.toggle('active', isActive)
      tab.setAttribute('aria-selected', isActive)
    }
  })

  document.querySelectorAll('[data-ol-plans-v2-view]').forEach(el => {
    el.hidden = el.getAttribute('data-ol-plans-v2-view') !== viewTab
  })

  const tooltipEl = document.querySelector('[data-ol-plans-v2-m-a-tooltip]')
  if (tooltipEl) {
    tooltipEl.hidden = viewTab === 'group'
  }

  const licensePickerEl = document.querySelector(
    '[data-ol-plans-v2-license-picker-container]'
  )
  if (licensePickerEl) {
    licensePickerEl.hidden = viewTab !== 'group'
  }

  const monthlyAnnualSwitch = document.querySelector(
    '[data-ol-plans-v2-m-a-switch-container]'
  )
  if (monthlyAnnualSwitch) {
    monthlyAnnualSwitch.setAttribute('data-ol-current-view', viewTab)
  }

  if (viewTab === 'group') {
    updateMainGroupPlanPricing()
  }

  updateMonthlyAnnualSwitchValue(viewTab)

  toggleUniversityInfo(viewTab)

  // update the hash to reflect the current view when switching individual, group, or student tabs
  setHashFromViewTab(viewTab, currentMonthlyAnnualSwitchValue)

  showQuoteForTab(viewTab)
}

function updateMonthlyAnnualSwitchValue(viewTab) {
  // group tab is special because group plan only has annual value
  // so we need to perform some UI changes whenever user click the group tab
  if (viewTab === 'group') {
    toggleMonthlyAnnualSwitching(viewTab, 'annual')
  } else {
    toggleMonthlyAnnualSwitching(viewTab, currentMonthlyAnnualSwitchValue)
  }
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

  const tabs = document.querySelectorAll(
    '[data-ol-plans-v2-view-tab] [role="tab"]'
  )

  if (tabs) {
    tabs.forEach(tab => {
      tab.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          const currentIndex = Array.from(tabs).indexOf(tab)
          const nextIndex =
            event.key === 'ArrowLeft' ? currentIndex - 1 : currentIndex + 1
          const newIndex = (nextIndex + tabs.length) % tabs.length
          tabs[newIndex].focus()
        }
      })
    })
  }
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
  if (el) {
    el.hidden = viewTab !== 'student'
  }
}

// This is the old scheme for hashing redirection
// This is deprecated and should be removed in the future
// This is only used for backward compatibility
function selectViewFromHashDeprecated() {
  try {
    const params = new URLSearchParams(window.location.hash.substring(1))
    const view = params.get('view')
    if (view) {
      // View params are expected to be of the format e.g. individual or individual-monthly
      const [tab, period] = view.split('-')
      // make sure the selected view is valid
      if (document.querySelector(`[data-ol-plans-v2-view-tab="${tab}"]`)) {
        selectTab(tab)

        if (['monthly', 'annual'].includes(period)) {
          currentMonthlyAnnualSwitchValue = period
        } else {
          // set annual as the default
          currentMonthlyAnnualSwitchValue = 'annual'
        }

        updateMonthlyAnnualSwitchValue(tab)

        // change the hash with the new scheme
        setHashFromViewTab(tab, currentMonthlyAnnualSwitchValue)
      }
    }
  } catch {
    // do nothing
  }
}

function selectViewAndPeriodFromHash() {
  const [viewTab, period] = getViewInfoFromHash()

  // the sequence of these three lines is important
  // because `currentMonthlyAnnualSwitchValue` is mutable.
  // `selectTab` and `updateMonthlyAnnualSwitchValue` depend on the value of `currentMonthlyAnnualSwitchValue`
  // to determine the UI state
  currentMonthlyAnnualSwitchValue = period
  selectTab(viewTab)
  updateMonthlyAnnualSwitchValue(viewTab)

  // handle the case where user access plans page while still on the plans page
  // current example would the the "For students" link on the footer
  const SCROLL_TO_TOP_DELAY = 50
  window.setTimeout(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, SCROLL_TO_TOP_DELAY)
}

// call the function to select the view and period from the hash value
// this is called once when the page is loaded
if (window.location.hash) {
  if (window.location.hash.includes('view')) {
    selectViewFromHashDeprecated()
  } else {
    selectViewAndPeriodFromHash()
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

    // update the hash to reflect the current view when pressing the monthly-annual switch
    const DEFAULT_VIEW_TAB = 'individual'
    const viewTab =
      document
        .querySelector('[data-ol-plans-v2-m-a-switch-container]')
        .getAttribute('data-ol-current-view') ?? DEFAULT_VIEW_TAB

    setHashFromViewTab(viewTab, currentMonthlyAnnualSwitchValue)
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
handleForStudentsLinkInFooter()

window.addEventListener('hashchange', () => {
  if (window.location.hash) {
    if (window.location.hash.includes('view')) {
      selectViewFromHashDeprecated()
    } else {
      selectViewAndPeriodFromHash()
    }
  }
})

sendPlansViewEvent()
