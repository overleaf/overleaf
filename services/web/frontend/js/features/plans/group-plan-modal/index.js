import getMeta from '../../../utils/meta'
import { swapModal } from '../../utils/swapModal'
import * as eventTracking from '../../../infrastructure/event-tracking'

function getFormValues() {
  const modalEl = document.querySelector('[data-ol-group-plan-modal]')
  const planCode = modalEl.querySelector('#plan_code').value
  const size = modalEl.querySelector('#size').value
  const currency = modalEl.querySelector('#currency').value
  const usage = modalEl.querySelector('#usage').value
  return { planCode, size, currency, usage }
}

function updateGroupPlanView() {
  const prices = getMeta('ol-groupPlans')
  const currencySymbols = getMeta('ol-currencySymbols')

  const modalEl = document.querySelector('[data-ol-group-plan-modal]')
  const { planCode, size, currency, usage } = getFormValues()

  const price = prices[usage][planCode][currency][size]
  const currencySymbol = currencySymbols[currency]
  const displayPrice = `${currencySymbol}${price}`

  modalEl.querySelectorAll('[data-ol-group-plan-plan-code]').forEach(el => {
    el.hidden = el.getAttribute('data-ol-group-plan-plan-code') !== planCode
  })
  modalEl.querySelectorAll('[data-ol-group-plan-usage]').forEach(el => {
    el.hidden = el.getAttribute('data-ol-group-plan-usage') !== usage
  })
  modalEl.querySelector(
    '[data-ol-group-plan-display-price]'
  ).innerText = displayPrice
  modalEl.querySelector(
    '[data-ol-group-plan-for-n-users]'
  ).innerText = `For ${size} users`
}

const modalEl = $('[data-ol-group-plan-modal]')
modalEl
  .on('shown.bs.modal', function () {
    const path = `${window.location.pathname}${window.location.search}`
    history.replaceState(null, document.title, path + '#groups')
  })
  .on('hidden.bs.modal', function () {
    history.replaceState(null, document.title, window.location.pathname)
  })

function showGroupPlanModal() {
  modalEl.modal()
  eventTracking.send(
    'subscription-funnel',
    'plans-page',
    'group-inquiry-potential'
  )
}

document
  .querySelectorAll('[data-ol-group-plan-form] select')
  .forEach(el => el.addEventListener('change', updateGroupPlanView))
document.querySelectorAll('[data-ol-purchase-group-plan]').forEach(el =>
  el.addEventListener('click', e => {
    e.preventDefault()

    const { planCode, size, currency, usage } = getFormValues()
    const queryParams = new URLSearchParams(
      Object.entries({
        planCode: `group_${planCode}_${size}_${usage}`,
        currency,
        itm_campaign: 'groups',
      })
    )
    const itmContent = getMeta('ol-itm_content')
    if (itmContent) {
      queryParams.set('itm_content', itmContent)
    }
    const url = new URL('/user/subscription/new', window.origin)
    url.search = queryParams.toString()
    window.location = url.toString()
  })
)

document.querySelectorAll('[data-ol-open-group-plan-modal]').forEach(el => {
  el.addEventListener('click', function (e) {
    e.preventDefault()
    showGroupPlanModal()
  })
})

document
  .querySelectorAll('[data-ol-open-contact-form-for-more-than-50-licenses]')
  .forEach(el => {
    el.addEventListener('click', function (e) {
      e.preventDefault()
      swapModal(
        '[data-ol-group-plan-modal]',
        '[data-ol-contact-form-modal="general"]'
      )
    })
  })

updateGroupPlanView()

if (window.location.hash === '#groups') {
  showGroupPlanModal()
}
