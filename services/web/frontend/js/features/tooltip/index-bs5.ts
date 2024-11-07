import { Tooltip } from 'bootstrap-5'

const footerLanguageElement = document.querySelector(
  '[data-ol-lang-selector-tooltip]'
) as Element

const allTooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]')

const possibleTooltips = document.querySelectorAll(
  '[data-bs-toggle="tooltip-if-needed"]'
)

// eslint-disable-next-line no-unused-vars
const footLangTooltip = new Tooltip(footerLanguageElement)

allTooltips.forEach(element => {
  // eslint-disable-next-line no-unused-vars
  const tooltip = new Tooltip(element)
})

possibleTooltips.forEach(element => {
  // put data-bs-toggle="tooltip-if-needed" on .badge-content
  // then tooltip is only shown if .badge is clipped due to max-width
  if (
    element.parentElement &&
    element.scrollWidth > element.parentElement?.scrollWidth
  ) {
    // eslint-disable-next-line no-unused-vars
    const tooltip = new Tooltip(element)
  }
})
