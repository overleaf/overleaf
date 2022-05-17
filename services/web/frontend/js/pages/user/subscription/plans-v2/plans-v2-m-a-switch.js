// m-a stands for monthly-annual

// We need this mutable variable because the group tab only have annual.
// There's some difference between the monthly and annual UI
// and since monthly-annual switch is disabled for the group tab,
// we need to introduce a new variable to store the information
let currentMonthlyAnnualSwitchValue = 'monthly'

// only executed if switching to group tab
export function disableMonthlyAnnualSwitching() {
  const containerEl = document.querySelector(
    '[data-ol-plans-v2-m-a-switch-container]'
  )
  const checkbox = containerEl.querySelector('input[type="checkbox"]')

  containerEl.classList.add('disabled')

  checkbox.disabled = true
  checkbox.checked = true

  document
    .querySelectorAll('[data-ol-plans-v2-table-container]')
    .forEach(el => {
      const period = el.getAttribute('data-ol-plans-v2-table-container')
      if (period === 'annual') {
        el.hidden = false
      } else {
        el.hidden = true
      }
    })
  document
    .querySelectorAll('[data-ol-plans-v2-table-annual-price-before-discount]')
    .forEach(el => {
      el.classList.remove('hidden')
    })
}

// executed if switching from group tab to individual and student tab
export function enableMonthlyAnnualSwitching() {
  const containerEl = document.querySelector(
    '[data-ol-plans-v2-m-a-switch-container]'
  )
  const checkbox = containerEl.querySelector('input[type="checkbox"]')
  containerEl.classList.remove('disabled')

  checkbox.disabled = false

  if (currentMonthlyAnnualSwitchValue === 'annual') {
    checkbox.checked = true
  } else {
    checkbox.checked = false
    document
      .querySelectorAll('[data-ol-plans-v2-table-container]')
      .forEach(el => {
        const period = el.getAttribute('data-ol-plans-v2-table-container')
        if (period === 'annual') {
          el.hidden = true
        } else {
          el.hidden = false
        }
      })
    document
      .querySelectorAll('[data-ol-plans-v2-table-annual-price-before-discount]')
      .forEach(el => {
        el.classList.add('hidden')
      })
  }
}

export function hideMonthlyAnnualSwitchOnSmallScreen() {
  const smallScreen = window.matchMedia('(max-width: 767px)').matches

  if (smallScreen) {
    const el = document.querySelector('[data-ol-plans-v2-m-a-switch-container]')

    el.hidden = true
  }
}

export function showMonthlyAnnualSwitchOnSmallScreen() {
  const smallScreen = window.matchMedia('(max-width: 767px)').matches

  if (smallScreen) {
    const el = document.querySelector('[data-ol-plans-v2-m-a-switch-container]')

    el.hidden = false
  }
}

// in group tab, there are no "20% discount"
// tooltip in the monthly-annual switch "annual" text.
// so, we need to hide it
export function showMonthlyAnnualTooltip() {
  const el = document.querySelector('[data-ol-plans-v2-m-a-tooltip]')

  el.hidden = false
}

export function hideMonthlyAnnualTooltip() {
  const el = document.querySelector('[data-ol-plans-v2-m-a-tooltip]')

  el.hidden = true
}

// "20% discount" tooltip in the monthly-annual switch will have a different
// text and different colour, so we need to switch them accordingly
function switchMonthlyAnnualTooltip() {
  const el = document.querySelector('[data-ol-plans-v2-m-a-tooltip]')
  if (currentMonthlyAnnualSwitchValue === 'annual') {
    el.classList.remove('plans-v2-m-a-tooltip-annual-selected')
    document.querySelectorAll('[data-ol-tooltip-period]').forEach(childEl => {
      const period = childEl.getAttribute('data-ol-tooltip-period')
      if (period === 'monthly') {
        childEl.hidden = false
      } else {
        childEl.hidden = true
      }
    })
  } else {
    el.classList.add('plans-v2-m-a-tooltip-annual-selected')
    document.querySelectorAll('[data-ol-tooltip-period]').forEach(childEl => {
      const period = childEl.getAttribute('data-ol-tooltip-period')
      if (period === 'annual') {
        childEl.hidden = false
      } else {
        childEl.hidden = true
      }
    })
  }
}

function changeMonthlyAnnualTooltipPosition() {
  const smallScreen = window.matchMedia('(max-width: 767px)').matches
  const el = document.querySelector('[data-ol-plans-v2-m-a-tooltip]')

  if (smallScreen) {
    el.classList.replace('right', 'bottom')
  } else {
    el.classList.replace('bottom', 'right')
  }
}

// month and annual value will each have its own set of tables that we need to
// switch accordingly
function switchMonthlyAnnualTable() {
  const isAnnualPricing = document.querySelector(
    '[data-ol-plans-v2-m-a-switch] input[type="checkbox"]'
  ).checked

  if (isAnnualPricing) {
    currentMonthlyAnnualSwitchValue = 'annual'
  } else {
    currentMonthlyAnnualSwitchValue = 'monthly'
  }

  document
    .querySelectorAll('[data-ol-plans-v2-table-annual-price-before-discount]')
    .forEach(el => {
      if (isAnnualPricing) {
        el.classList.remove('hidden')
      } else {
        el.classList.add('hidden')
      }
    })

  document
    .querySelectorAll('[data-ol-plans-v2-table-container]')
    .forEach(el => {
      const period = el.getAttribute('data-ol-plans-v2-table-container')
      if (isAnnualPricing) {
        if (period === 'annual') {
          el.hidden = false
        } else {
          el.hidden = true
        }
      } else {
        if (period === 'annual') {
          el.hidden = true
        } else {
          el.hidden = false
        }
      }
    })
}

export function underlineAnnualText() {
  document
    .querySelector('[data-ol-plans-v2-m-a-switch-monthly-text]')
    .classList.remove('underline')
  document
    .querySelector('[data-ol-plans-v2-m-a-switch-annual-text]')
    .classList.add('underline')
}

function underlineMonthlyText() {
  document
    .querySelector('[data-ol-plans-v2-m-a-switch-monthly-text]')
    .classList.add('underline')
  document
    .querySelector('[data-ol-plans-v2-m-a-switch-annual-text]')
    .classList.remove('underline')
}

// if annual is active, we need to underline the "annual" text
// if monthly is active, we need to underline the "monthly" text
export function switchUnderlineText() {
  if (currentMonthlyAnnualSwitchValue === 'annual') {
    underlineAnnualText()
  } else {
    underlineMonthlyText()
  }
}

// click event listener for monthly-annual switch
export function setUpMonthlyAnnualSwitching() {
  document
    .querySelector('[data-ol-plans-v2-m-a-switch]')
    .addEventListener('click', () => {
      switchMonthlyAnnualTooltip()
      switchMonthlyAnnualTable()
      switchUnderlineText()
    })

  changeMonthlyAnnualTooltipPosition()
  window.addEventListener('resize', changeMonthlyAnnualTooltipPosition)
}
