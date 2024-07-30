import { updateGroupModalPlanPricing } from '../../../../features/plans/group-plan-modal'
import '../../../../features/plans/plans-v2-group-plan-modal'
import {
  createLocalizedGroupPlanPrice,
  formatCurrencyDefault,
} from '../../../../features/plans/utils/group-plan-pricing'
import getMeta from '../../../../utils/meta'
import { getSplitTestVariant } from '@/utils/splitTestUtils'
import { formatCurrencyLocalized } from '@/shared/utils/currency'

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

  const localCcyVariant = getSplitTestVariant('local-ccy-format-v2')
  const formatCurrency =
    localCcyVariant === 'enabled'
      ? formatCurrencyLocalized
      : formatCurrencyDefault
  const {
    localizedPrice: localizedPriceProfessional,
    localizedPerUserPrice: localizedPerUserPriceProfessional,
  } = createLocalizedGroupPlanPrice({
    plan: 'professional',
    licenseSize,
    currency,
    usage,
    formatCurrency,
  })

  const {
    localizedPrice: localizedPriceCollaborator,
    localizedPerUserPrice: localizedPerUserPriceCollaborator,
  } = createLocalizedGroupPlanPrice({
    plan: 'collaborator',
    licenseSize,
    currency,
    usage,
    formatCurrency,
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

  formEl
    .querySelector('.plans-v2-license-picker-educational-discount')
    .classList.toggle(
      'total-licenses-not-eligible-for-discount',
      notEligibleForEducationalDiscount
    )

  formEl.querySelector(
    '[data-ol-plans-v2-license-picker-educational-discount-input]'
  ).disabled = notEligibleForEducationalDiscount

  if (notEligibleForEducationalDiscount) {
    // force disable educational discount checkbox
    formEl.querySelector(
      '[data-ol-plans-v2-license-picker-educational-discount-input]'
    ).checked = false
  }

  changeNumberOfUsersInTableHead()
  changeNumberOfUsersInFeatureTable()
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

export function changeNumberOfUsersInFeatureTable() {
  document
    .querySelectorAll(
      '[data-ol-plans-v2-table-cell-plan^="group"][data-ol-plans-v2-table-cell-feature="number_of_users"]'
    )
    .forEach(el => {
      const licenseSize = document.querySelector(
        '[data-ol-plans-v2-license-picker-select]'
      ).value

      el.textContent = el.textContent.replace(/\d+/, licenseSize)
    })
}

export function changeNumberOfUsersInTableHead() {
  document
    .querySelectorAll('[data-ol-plans-v2-table-th-group-license-size]')
    .forEach(el => {
      const licenseSize = el.getAttribute(
        'data-ol-plans-v2-table-th-group-license-size'
      )
      const currentLicenseSize = document.querySelector(
        '[data-ol-plans-v2-license-picker-select]'
      ).value

      el.hidden = licenseSize !== currentLicenseSize
    })
}
