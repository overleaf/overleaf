import '../../../../marketing'

import * as eventTracking from '../../../../infrastructure/event-tracking'
import {
  setUpStickyHeaderObserver,
  switchStickyHeader,
} from './plans-v2-sticky-header'
import {
  disableMonthlyAnnualSwitching,
  enableMonthlyAnnualSwitching,
  hideMonthlyAnnualSwitchOnSmallScreen,
  showMonthlyAnnualSwitchOnSmallScreen,
  hideMonthlyAnnualTooltip,
  showMonthlyAnnualTooltip,
  setUpMonthlyAnnualSwitching,
  underlineAnnualText,
  switchUnderlineText,
} from './plans-v2-m-a-switch'
import {
  changeGroupPlanModalEducationalDiscount,
  changeGroupPlanModalNumberOfLicenses,
  hideGroupPlansLicensePicker,
  showGroupPlansLicensePicker,
  updateGroupPricing,
} from './plans-v2-group-plan'
import { setUpGroupSubscriptionButtonAction } from './plans-v2-subscription-button'
import { checkIfGroupModalOpen } from '../../../../features/plans/plans-v2-group-plan-modal'
import { updateLinkTargets } from '../plans'

function selectTab(viewTab) {
  document.querySelectorAll('[data-ol-plans-v2-view-tab]').forEach(el => {
    if (el.getAttribute('data-ol-plans-v2-view-tab') === viewTab) {
      el.classList.add('active')
    } else {
      el.classList.remove('active')
    }
  })

  document.querySelectorAll('[data-ol-plans-v2-view]').forEach(el => {
    el.hidden = el.getAttribute('data-ol-plans-v2-view') !== viewTab
  })

  switchUnderlineText()
  switchStickyHeader(viewTab)

  // group tab is special because group plan only has annual value
  // so we need to perform some UI changes whenever user click the group tab
  if (viewTab === 'group') {
    disableMonthlyAnnualSwitching()
    hideMonthlyAnnualTooltip()
    updateGroupPricing()
    underlineAnnualText()
    showGroupPlansLicensePicker()
    hideMonthlyAnnualSwitchOnSmallScreen()
  } else {
    enableMonthlyAnnualSwitching()
    showMonthlyAnnualTooltip()
    hideGroupPlansLicensePicker()
    showMonthlyAnnualSwitchOnSmallScreen()
  }
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
        updateGroupPricing()
        if (!checkIfGroupModalOpen()) {
          changeGroupPlanModalNumberOfLicenses()
        }
      })
    })

  document
    .querySelectorAll(
      '[data-ol-plans-v2-license-picker-educational-discount-input]'
    )
    .forEach(el =>
      el.addEventListener('change', () => {
        updateGroupPricing()
        if (!checkIfGroupModalOpen()) {
          changeGroupPlanModalEducationalDiscount()
        }
      })
    )
}

setUpTabSwitching()
setUpGroupPlanPricingChange()
setUpMonthlyAnnualSwitching()
setUpGroupSubscriptionButtonAction()
setUpStickyHeaderObserver()
updateLinkTargets()
