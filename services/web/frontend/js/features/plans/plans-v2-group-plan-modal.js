import './group-plan-modal'
import { updateMainGroupPlanPricing } from '../../pages/user/subscription/plans-v2/plans-v2-group-plan'

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

  // update license picker on the main plans page
  mainPlansPageLicensePickerEl.value = groupPlanModalNumberOfLicenses

  // update educational discount checkbox on the main plans page
  //
  // extra note
  // for number of users < 10, there is a difference on the checkbox behaviour
  // between the group plan modal and the main plan page
  //
  // On the group plan modal, the checkbox button is not visually disabled for number of users < 10 (checkbox can still be clicked)
  // but the logic is disabled and there will be an extra text whether or not the discount is applied
  //
  // However, on the main group plan page, the checkbox button is visually disabled for number of users < 10 (checkbox can not be clicked)
  // Hence, there's a possibility that the checkbox on the group plan modal is checked, but the discount is not applied.
  // i.e user can still click the checkbox with number of users < 10. The price won't be discounted, but the checkbox is checked.
  if (groupPlanModalNumberOfLicenses >= 10) {
    mainPlansPageEducationalDiscountEl.checked = educationalDiscountEnabled
  } else {
    // The code below is for disabling the checkbox button on the main plan page for number of users <10
    // while still checking the educational discount
    if (educationalDiscountChecked) {
      mainPlansPageEducationalDiscountEl.checked = false
    }
  }

  updateMainGroupPlanPricing()
}

function hideCurrencyPicker() {
  document.querySelector('[data-ol-group-plan-form-currency]').hidden = true
}

document.querySelectorAll('[data-ol-group-plan-form] select').forEach(el =>
  el.addEventListener('change', () => {
    changePlansV2MainPageGroupData()
  })
)
document
  .querySelectorAll('[data-ol-group-plan-form] input')
  .forEach(el => el.addEventListener('change', changePlansV2MainPageGroupData))

const isGroupPlanModalAvailable = document.querySelector(
  '[data-ol-group-plan-modal]'
)

if (isGroupPlanModalAvailable) {
  hideCurrencyPicker()
}
