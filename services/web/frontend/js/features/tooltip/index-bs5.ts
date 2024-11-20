import { Tooltip } from 'bootstrap-5'

function getElementWidth(el: Element) {
  const elComputedStyle = window.getComputedStyle(el)
  const elPaddingX =
    parseFloat(elComputedStyle.paddingLeft) +
    parseFloat(elComputedStyle.paddingRight)
  const elBorderX =
    parseFloat(elComputedStyle.borderLeftWidth) +
    parseFloat(elComputedStyle.borderRightWidth)
  return el.scrollWidth - elPaddingX - elBorderX
}

const footerLanguageElement = document.querySelector(
  '[data-ol-lang-selector-tooltip]'
) as Element
if (footerLanguageElement) {
  // eslint-disable-next-line no-new
  new Tooltip(footerLanguageElement)
}

const allTooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]')
allTooltips.forEach(element => {
  // eslint-disable-next-line no-unused-vars
  const tooltip = new Tooltip(element)
})

const possibleBadgeTooltips = document.querySelectorAll('[data-badge-tooltip]')
possibleBadgeTooltips.forEach(element => {
  // Put data-badge-tooltip on .badge-content
  // then tooltip is only shown if content is clipped due to max-width on .badge
  // Due to font loading, the width calculated on page load might change, so we might
  // incorrectly determine a tooltip is not needed. This is why max-width will always be set to none
  // if no tooltip is shown so that content is fully visible in those scenarios.

  if (element.parentElement) {
    const parentWidth = getElementWidth(element.parentElement)
    if (element.scrollWidth > parentWidth) {
      // eslint-disable-next-line no-unused-vars
      const tooltip = new Tooltip(element)
    } else {
      element.parentElement.style.maxWidth = 'none'
    }
  }
})
