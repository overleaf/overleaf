import { updateGroupModalPlanPricing } from '../../../../features/plans/group-plan-modal'

function showGroupPlanModal(el) {
  const plan = el.getAttribute('data-ol-start-new-subscription')

  // plan is either `group_collaborator` or `group_professional`
  // we want to get the suffix (collaborator or professional)
  const groupPlan = plan.split('_')[1]

  const groupModalRadioInputEl = document.querySelector(
    `[data-ol-group-plan-code="${groupPlan}"]`
  )

  groupModalRadioInputEl.checked = true
  updateGroupModalPlanPricing()

  const modalEl = $('[data-ol-group-plan-modal]')
  modalEl.modal()
}

export function setUpGroupSubscriptionButtonAction() {
  document.querySelectorAll('[data-ol-start-new-subscription]').forEach(el => {
    const plan = el.getAttribute('data-ol-start-new-subscription')

    if (plan === 'group_collaborator' || plan === 'group_professional') {
      el.addEventListener('click', e => {
        e.preventDefault()
        showGroupPlanModal(el)
      })
    }
  })
}
