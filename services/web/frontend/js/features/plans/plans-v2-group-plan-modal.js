import './group-plan-modal'
import getMeta from '../../utils/meta'

const NEW_PLANS_PAGE_VARIANT = 'new-plans-page'

export function checkIfGroupModalOpen() {
  return window.location.hash.includes('groups')
}

export function changePlansV2MainPageGroupData() {
  const mainPlansPageFormEl = document.querySelector(
    '[data-ol-plans-v2-license-picker-form]'
  )
  const mainPlansPageLicensePickerEl = mainPlansPageFormEl.querySelector(
    '[data-ol-plans-v2-license-picker-select]'
  )

  const mainPlansPageEducationalDiscountEl = mainPlansPageFormEl.querySelector(
    '[data-ol-plans-v2-license-picker-educational-discount-input]'
  )

  const groupPlanModalNumberOfLicenses = document.querySelector(
    '[data-ol-group-plan-modal] #size'
  ).value

  const educationalDiscountChecked = document.querySelector(
    '[data-ol-group-plan-modal] #usage'
  ).checked

  const educationalDiscountEnabled =
    educationalDiscountChecked && groupPlanModalNumberOfLicenses >= 10

  if (checkIfGroupModalOpen()) {
    // update license picker on the main plans page
    mainPlansPageLicensePickerEl.value = groupPlanModalNumberOfLicenses
    mainPlansPageLicensePickerEl.dispatchEvent(new Event('change'))

    // update educational discount checkbox on the main plans page
    if (groupPlanModalNumberOfLicenses >= 10) {
      mainPlansPageEducationalDiscountEl.checked = educationalDiscountEnabled
      mainPlansPageEducationalDiscountEl.dispatchEvent(new Event('change'))
    } else {
      if (educationalDiscountChecked) {
        mainPlansPageEducationalDiscountEl.checked = false
        mainPlansPageEducationalDiscountEl.dispatchEvent(new Event('change'))
      }
    }
  }
}

function hideCurrencyPicker() {
  document.querySelector('[data-ol-group-plan-form-currency]').hidden = true
}

const plansPageVariant =
  getMeta('ol-splitTestVariants')?.['plans-page-layout-v2'] ?? 'default'

if (plansPageVariant === NEW_PLANS_PAGE_VARIANT) {
  hideCurrencyPicker()

  // we need to sync the form data between group plan modal
  // and the main plan page
  document.querySelectorAll('[data-ol-group-plan-code]').forEach(el => {
    // listening to new CustomEvent 'showmodal'
    // we do this to check whether user clicks the "Standard (Collaborator)" plan or the "Professional" plan
    // and the radio button on the group plan modal will then be 'checked' accordingly
    el.addEventListener('showmodal', () => {
      if (!checkIfGroupModalOpen()) {
        el.checked = true
        el.dispatchEvent(new Event('change'))
      }
    })
  })
}

document
  .querySelectorAll('[data-ol-group-plan-form] select')
  .forEach(el => el.addEventListener('change', changePlansV2MainPageGroupData))
document
  .querySelectorAll('[data-ol-group-plan-form] input')
  .forEach(el => el.addEventListener('change', changePlansV2MainPageGroupData))
