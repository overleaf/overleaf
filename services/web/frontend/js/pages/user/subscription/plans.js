import '../../../marketing'
import '../../../features/plans/group-plan-modal'

import * as eventTracking from '../../../infrastructure/event-tracking'
import getMeta from '../../../utils/meta'

let currentView = 'monthly'
let currentCurrencyCode = getMeta('ol-recommendedCurrency')

function selectView(view) {
  document.querySelectorAll('[data-ol-view-tab]').forEach(el => {
    if (el.getAttribute('data-ol-view-tab') === view) {
      el.classList.add('active')
    } else {
      el.classList.remove('active')
    }
  })
  document.querySelectorAll('[data-ol-view]').forEach(el => {
    el.hidden = el.getAttribute('data-ol-view') !== view
  })
  currentView = view
  updateLinkTargets()
}

function setUpViewSwitching(liEl) {
  const view = liEl.getAttribute('data-ol-view-tab')
  liEl.querySelector('a').addEventListener('click', function (e) {
    e.preventDefault()
    eventTracking.send('subscription-funnel', 'plans-page', `${view}-prices`)
    eventTracking.sendMB('plans-page-toggle', { button: view })
    selectView(view)
  })
}

function setUpCurrencySwitching(linkEl) {
  const currencyCode = linkEl.getAttribute('data-ol-currencyCode-switch')
  linkEl.addEventListener('click', function (e) {
    e.preventDefault()
    document.querySelectorAll('[data-ol-currencyCode]').forEach(el => {
      el.hidden = el.getAttribute('data-ol-currencyCode') !== currencyCode
    })
    currentCurrencyCode = currencyCode
    eventTracking.sendMB('plans-page-currency', { currency: currencyCode })
    updateLinkTargets()
  })
}

function setUpSubscriptionTracking(linkEl) {
  const plan =
    linkEl.getAttribute('data-ol-tracking-plan') ||
    linkEl.getAttribute('data-ol-start-new-subscription')
  const location = linkEl.getAttribute('data-ol-location')
  const period = linkEl.getAttribute('data-ol-item-view') || currentView

  linkEl.addEventListener('click', function () {
    const customLabel = linkEl.getAttribute('data-ol-tracking-label')
    const computedLabel = currentView === 'annual' ? `${plan}_annual` : plan
    const label = customLabel || computedLabel

    eventTracking.sendMB('plans-page-start-trial') // deprecated by plans-page-click
    eventTracking.send('subscription-funnel', 'sign_up_now_button', label) // deprecated by plans-page-click
    eventTracking.sendMB('plans-page-click', {
      button: plan,
      location,
      period,
    })
  })
}

function updateLinkTargets() {
  document.querySelectorAll('[data-ol-start-new-subscription]').forEach(el => {
    if (el.hasAttribute('data-ol-has-custom-href')) return

    const plan = el.getAttribute('data-ol-start-new-subscription')
    const view = el.getAttribute('data-ol-item-view') || currentView
    const suffix = view === 'annual' ? `-annual` : `_free_trial_7_days`
    const planCode = `${plan}${suffix}`

    const location = el.getAttribute('data-ol-location')
    el.href = `/user/subscription/new?planCode=${planCode}&currency=${currentCurrencyCode}&itm_campaign=plans&itm_content=${location}`
  })
}

function selectViewFromHash() {
  try {
    const params = new URLSearchParams(window.location.hash.substring(1))
    const view = params.get('view')
    if (view) {
      // make sure the selected view is valid
      if (document.querySelector(`[data-ol-view-tab="${view}"]`)) {
        selectView(view)
        // clear the hash so it doesn't persist when switching plans
        window.location.hash = ''
      }
    }
  } catch {
    // do nothing
  }
}

document.querySelectorAll('[data-ol-view-tab]').forEach(setUpViewSwitching)
document
  .querySelectorAll('[data-ol-currencyCode-switch]')
  .forEach(setUpCurrencySwitching)
document
  .querySelectorAll('[data-ol-start-new-subscription]')
  .forEach(setUpSubscriptionTracking)
updateLinkTargets()

selectViewFromHash()
window.addEventListener('hashchange', selectViewFromHash)
