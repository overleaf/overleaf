import { Tooltip } from 'bootstrap-5'

const footerLanguageElement = document.querySelector(
  '[data-ol-lang-selector-tooltip]'
) as Element

const allTooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]')

// eslint-disable-next-line no-unused-vars
const footLangTooltip = new Tooltip(footerLanguageElement)

allTooltips.forEach(element => {
  // eslint-disable-next-line no-unused-vars
  const tooltip = new Tooltip(element)
})
