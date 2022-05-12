function sendShowModalEvent(plan) {
  const groupPlan = plan.split('_')[1]

  const groupModalRadioInputEl = document.querySelector(
    `[data-ol-group-plan-code="${groupPlan}"]`
  )

  groupModalRadioInputEl.dispatchEvent(new CustomEvent('showmodal'))
}

function showGroupPlanModal(el) {
  const plan = el.getAttribute('data-ol-start-new-subscription')

  sendShowModalEvent(plan)

  const modalEl = $('[data-ol-group-plan-modal]')
  modalEl
    .on('shown.bs.modal', function () {
      const path = `${window.location.pathname}${window.location.search}`
      history.replaceState(null, document.title, path + '#groups')
    })
    .on('hidden.bs.modal', function () {
      history.replaceState(null, document.title, window.location.pathname)
    })

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
