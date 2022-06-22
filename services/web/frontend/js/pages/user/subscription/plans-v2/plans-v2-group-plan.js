import { updateGroupModalPlanPricing } from '../../../../features/plans/group-plan-modal'
import '../../../../features/plans/plans-v2-group-plan-modal'
import getMeta from '../../../../utils/meta'

const MINIMUM_NUMBER_OF_LICENSES_EDUCATIONAL_DISCOUNT = 10

export function updateMainGroupPlanPricing() {
  const groupPlans = getMeta('ol-groupPlans')
  const currencySymbols = getMeta('ol-currencySymbols')
  const currentCurrencyCode = getMeta('ol-recommendedCurrency')

  const formEl = document.querySelector(
    '[data-ol-plans-v2-license-picker-form]'
  )
  const numberOfLicenses = formEl.querySelector(
    '[data-ol-plans-v2-license-picker-select]'
  ).value
  const currency = currentCurrencyCode
  const currencySymbol = currencySymbols[currency]
  const usage = formEl.querySelector(
    '[data-ol-plans-v2-license-picker-educational-discount-input]'
  ).checked
    ? 'educational'
    : 'enterprise'

  function calculatePrice(plan) {
    const priceInCents =
      groupPlans[usage][plan][currency][numberOfLicenses].price_in_cents
    const priceInUnit = (priceInCents / 100).toFixed()
    const perUserPrice = (priceInCents / 100 / numberOfLicenses).toFixed(2)

    return { priceInUnit, perUserPrice }
  }

  const {
    priceInUnit: priceInUnitProfessional,
    perUserPrice: perUserPriceProfessional,
  } = calculatePrice('professional')
  let displayPriceProfessional = `${currencySymbol}${priceInUnitProfessional}`
  let displayPerUserPriceProfessional = `${currencySymbol}${perUserPriceProfessional}`

  const {
    priceInUnit: priceInUnitCollaborator,
    perUserPrice: perUserPriceCollaborator,
  } = calculatePrice('collaborator')
  let displayPriceCollaborator = `${currencySymbol}${priceInUnitCollaborator}`
  let displayPerUserPriceCollaborator = `${currencySymbol}${perUserPriceCollaborator}`

  if (currencySymbol === 'kr') {
    displayPriceProfessional = `${priceInUnitProfessional} ${currencySymbol}`
    displayPerUserPriceProfessional = `${perUserPriceProfessional} ${currencySymbol}`
    displayPriceCollaborator = `${priceInUnitCollaborator} ${currencySymbol}`
    displayPerUserPriceCollaborator = `${perUserPriceCollaborator} ${currencySymbol}`
  } else if (currencySymbol === 'Fr') {
    displayPriceProfessional = `${currencySymbol} ${priceInUnitProfessional}`
    displayPerUserPriceProfessional = `${currencySymbol} ${perUserPriceProfessional}`
    displayPriceCollaborator = `${currencySymbol} ${priceInUnitCollaborator}`
    displayPerUserPriceCollaborator = `${currencySymbol} ${perUserPriceCollaborator}`
  }

  document.querySelector(
    '[data-ol-plans-v2-group-total-price="professional"]'
  ).innerText = displayPriceProfessional
  document.querySelector(
    '[data-ol-plans-v2-group-total-price="collaborator"]'
  ).innerText = displayPriceCollaborator

  document.querySelector(
    '[data-ol-plans-v2-group-price-per-user="collaborator"]'
  ).innerText = displayPerUserPriceCollaborator

  document.querySelector(
    '[data-ol-plans-v2-group-price-per-user="professional"]'
  ).innerText = displayPerUserPriceProfessional

  // educational discount can only be activated if numberOfLicenses is >= 10
  const notEligibleForDiscount =
    numberOfLicenses < MINIMUM_NUMBER_OF_LICENSES_EDUCATIONAL_DISCOUNT

  formEl
    .querySelector(
      '[data-ol-plans-v2-license-picker-educational-discount-label]'
    )
    .classList.toggle('disabled', notEligibleForDiscount)

  formEl.querySelector(
    '[data-ol-plans-v2-license-picker-educational-discount-input]'
  ).disabled = notEligibleForDiscount

  if (notEligibleForDiscount) {
    // force disable educational discount checkbox
    formEl.querySelector(
      '[data-ol-plans-v2-license-picker-educational-discount-input]'
    ).checked = false
  }
}

export function changeGroupPlanModalNumberOfLicenses() {
  const modalEl = document.querySelector('[data-ol-group-plan-modal]')
  const numberOfLicenses = document.querySelector(
    '[data-ol-plans-v2-license-picker-select]'
  ).value

  const groupPlanModalLicensePickerEl = modalEl.querySelector('#size')

  groupPlanModalLicensePickerEl.value = numberOfLicenses
  updateGroupModalPlanPricing()
}

export function changeGroupPlanModalEducationalDiscount() {
  const modalEl = document.querySelector('[data-ol-group-plan-modal]')
  const groupPlanModalEducationalDiscountEl = modalEl.querySelector('#usage')
  const educationalDiscountChecked = document.querySelector(
    '[data-ol-plans-v2-license-picker-educational-discount-input]'
  ).checked

  groupPlanModalEducationalDiscountEl.checked = educationalDiscountChecked
  updateGroupModalPlanPricing()
}
