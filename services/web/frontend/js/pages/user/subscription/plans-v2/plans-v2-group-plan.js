import { updateGroupModalPlanPricing } from '../../../../features/plans/group-plan-modal'
import '../../../../features/plans/plans-v2-group-plan-modal'
import { createLocalizedGroupPlanPrice } from '../../../../features/plans/utils/group-plan-pricing'
import getMeta from '../../../../utils/meta'

const MINIMUM_LICENSE_SIZE_EDUCATIONAL_DISCOUNT = 10

export function updateMainGroupPlanPricing() {
  const currency = getMeta('ol-recommendedCurrency')

  const formEl = document.querySelector(
    '[data-ol-plans-v2-license-picker-form]'
  )
  const licenseSize = formEl.querySelector(
    '[data-ol-plans-v2-license-picker-select]'
  ).value

  const usage = formEl.querySelector(
    '[data-ol-plans-v2-license-picker-educational-discount-input]'
  ).checked
    ? 'educational'
    : 'enterprise'

  const {
    localizedPrice: localizedPriceProfessional,
    localizedPerUserPrice: localizedPerUserPriceProfessional,
  } = createLocalizedGroupPlanPrice({
    plan: 'professional',
    licenseSize,
    currency,
    usage,
  })

  const {
    localizedPrice: localizedPriceCollaborator,
    localizedPerUserPrice: localizedPerUserPriceCollaborator,
  } = createLocalizedGroupPlanPrice({
    plan: 'collaborator',
    licenseSize,
    currency,
    usage,
  })

  document.querySelector(
    '[data-ol-plans-v2-group-total-price="professional"]'
  ).innerText = localizedPriceProfessional

  document.querySelector(
    '[data-ol-plans-v2-group-price-per-user="professional"]'
  ).innerText = localizedPerUserPriceProfessional

  document.querySelector(
    '[data-ol-plans-v2-group-total-price="collaborator"]'
  ).innerText = localizedPriceCollaborator

  document.querySelector(
    '[data-ol-plans-v2-group-price-per-user="collaborator"]'
  ).innerText = localizedPerUserPriceCollaborator

  const notEligibleForEducationalDiscount =
    licenseSize < MINIMUM_LICENSE_SIZE_EDUCATIONAL_DISCOUNT

  formEl
    .querySelector(
      '[data-ol-plans-v2-license-picker-educational-discount-label]'
    )
    .classList.toggle('disabled', notEligibleForEducationalDiscount)

  formEl.querySelector(
    '[data-ol-plans-v2-license-picker-educational-discount-input]'
  ).disabled = notEligibleForEducationalDiscount

  if (notEligibleForEducationalDiscount) {
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
