// m-a stands for monthly-annual

export function toggleMonthlyAnnualSwitching(
  view,
  currentMonthlyAnnualSwitchValue
) {
  const containerEl = document.querySelector(
    '[data-ol-plans-v2-m-a-switch-container]'
  )
  const checkbox = containerEl.querySelector('input[type="checkbox"]')

  containerEl.classList.toggle('disabled', view === 'group')

  checkbox.disabled = view === 'group'
  checkbox.checked = currentMonthlyAnnualSwitchValue === 'annual'

  switchMonthlyAnnual(currentMonthlyAnnualSwitchValue)
}

export function switchMonthlyAnnual(currentMonthlyAnnualSwitchValue) {
  const el = document.querySelector('[data-ol-plans-v2-m-a-tooltip]')
  el.classList.toggle(
    'plans-v2-m-a-tooltip-annual-selected',
    currentMonthlyAnnualSwitchValue === 'annual'
  )

  document.querySelectorAll('[data-ol-tooltip-period]').forEach(el => {
    const period = el.getAttribute('data-ol-tooltip-period')
    el.hidden = period !== currentMonthlyAnnualSwitchValue
  })

  document.querySelectorAll('[data-ol-plans-v2-period').forEach(el => {
    const period = el.getAttribute('data-ol-plans-v2-period')

    el.hidden = currentMonthlyAnnualSwitchValue !== period
  })

  document
    .querySelectorAll('[data-ol-plans-v2-m-a-switch-text]')
    .forEach(el => {
      el.classList.toggle(
        'underline',
        el.getAttribute('data-ol-plans-v2-m-a-switch-text') ===
          currentMonthlyAnnualSwitchValue
      )
    })
}

function changeMonthlyAnnualTooltipPosition() {
  const smallScreen = window.matchMedia('(max-width: 767px)').matches
  const el = document.querySelector('[data-ol-plans-v2-m-a-tooltip]')

  el.classList.toggle('bottom', smallScreen)
  el.classList.toggle('right', !smallScreen)
}

// click event listener for monthly-annual switch
export function setUpMonthlyAnnualSwitching() {
  changeMonthlyAnnualTooltipPosition()
  window.addEventListener('resize', changeMonthlyAnnualTooltipPosition)
}
