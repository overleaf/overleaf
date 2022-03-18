export function buildHighlightElement(highlight, wrapper) {
  const pageView = wrapper.viewer.getPageView(highlight.page - 1)

  const viewport = pageView.viewport

  const height = viewport.viewBox[3]

  const rect = viewport.convertToViewportRectangle([
    highlight.h, // xMin
    height - (highlight.v + highlight.height) + 10, // yMin
    highlight.h + highlight.width, // xMax
    height - highlight.v + 10, // yMax
  ])

  const [left, top, right, bottom] = wrapper.PDFJS.Util.normalizeRect(rect)

  const element = document.createElement('div')
  element.style.left = Math.floor(left) + 'px'
  element.style.top = Math.floor(top) + 'px'
  element.style.width = Math.ceil(right - left) + 'px'
  element.style.height = Math.ceil(bottom - top) + 'px'
  element.style.backgroundColor = 'rgba(255,255,0)'
  element.style.position = 'absolute'
  element.style.display = 'inline-block'
  element.style.scrollMargin = '72px'
  element.style.pointerEvents = 'none'
  element.style.opacity = '0'
  element.style.transition = 'opacity 0.5s'
  pageView.div.appendChild(element)

  window.setTimeout(() => {
    element.style.opacity = '0.3'

    window.setTimeout(() => {
      element.style.opacity = '0'
    }, 1000)
  }, 0)

  return element
}
