import { checkIfGroupModalOpen } from '../../../../features/plans/plans-v2-group-plan-modal'
import getMeta from '../../../../utils/meta'

const MINIMUM_NUMBER_OF_LICENSES_EDUCATIONAL_DISCOUNT = 10

export function updateGroupPricing() {
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

  const priceInCentsProfessional =
    groupPlans[usage].professional[currency][numberOfLicenses].price_in_cents
  const priceInUnitProfessional = (priceInCentsProfessional / 100).toFixed()
  const perUserPriceProfessional = parseFloat(
    (priceInCentsProfessional / 100 / numberOfLicenses).toFixed(2)
  )
  let displayPriceProfessional = `${currencySymbol}${priceInUnitProfessional}`
  let displayPerUserPriceProfessional = `${currencySymbol}${perUserPriceProfessional}`

  const priceInCentsCollaborator =
    groupPlans[usage].collaborator[currency][numberOfLicenses].price_in_cents
  const priceInUnitCollaborator = (priceInCentsCollaborator / 100).toFixed()
  const perUserPriceCollaborator = parseFloat(
    (priceInCentsCollaborator / 100 / numberOfLicenses).toFixed(2)
  )
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
    '[data-ol-group-price-per-user="collaborator"]'
  ).innerText = displayPerUserPriceCollaborator

  document.querySelector(
    '[data-ol-group-price-per-user="professional"]'
  ).innerText = displayPerUserPriceProfessional

  // educational discount can only be activated if numberOfLicenses is > 10
  if (numberOfLicenses < MINIMUM_NUMBER_OF_LICENSES_EDUCATIONAL_DISCOUNT) {
    formEl.querySelector(
      '[data-ol-plans-v2-license-picker-educational-discount-input]'
    ).disabled = true
    formEl.querySelector(
      '[data-ol-plans-v2-license-picker-educational-discount-input]'
    ).checked = false
    formEl
      .querySelector(
        '[data-ol-plans-v2-license-picker-educational-discount-label]'
      )
      .classList.add('disabled')
  } else {
    formEl.querySelector(
      '[data-ol-plans-v2-license-picker-educational-discount-input]'
    ).disabled = false
    formEl
      .querySelector(
        '[data-ol-plans-v2-license-picker-educational-discount-label]'
      )
      .classList.remove('disabled')
  }
}

export function showGroupPlansLicensePicker() {
  const el = document.querySelector(
    '[data-ol-plans-v2-license-picker-container]'
  )

  el.hidden = false
}

export function hideGroupPlansLicensePicker() {
  const el = document.querySelector(
    '[data-ol-plans-v2-license-picker-container]'
  )

  el.hidden = true
}

export function changeGroupPlanModalNumberOfLicenses() {
  const modalEl = document.querySelector('[data-ol-group-plan-modal]')
  const numberOfLicenses = document.querySelector(
    '[data-ol-plans-v2-license-picker-select]'
  ).value

  const groupPlanModalLicensePickerEl = modalEl.querySelector('#size')

  if (!checkIfGroupModalOpen()) {
    groupPlanModalLicensePickerEl.value = numberOfLicenses
    groupPlanModalLicensePickerEl.dispatchEvent(new Event('change'))
  }
}

export function changeGroupPlanModalEducationalDiscount() {
  const modalEl = document.querySelector('[data-ol-group-plan-modal]')
  const groupPlanModalEducationalDiscountEl = modalEl.querySelector('#usage')
  const educationalDiscountChecked = document.querySelector(
    '[data-ol-plans-v2-license-picker-educational-discount-input]'
  ).checked

  if (!checkIfGroupModalOpen()) {
    groupPlanModalEducationalDiscountEl.checked = educationalDiscountChecked
    groupPlanModalEducationalDiscountEl.dispatchEvent(new Event('change'))
  }
}
