import { PDFJS } from '@/features/pdf-preview/util/pdf-js'

export function buildHighlightElement(highlight, viewer) {
  const pageView = viewer.getPageView(highlight.page - 1)

  const viewport = pageView.viewport

  const height = viewport.viewBox[3]

  const rect = viewport.convertToViewportRectangle([
    highlight.h, // xMin
    height - (highlight.v + highlight.height) + 10, // yMin
    highlight.h + highlight.width, // xMax
    height - highlight.v + 10, // yMax
  ])

  const [left, top, right, bottom] = PDFJS.Util.normalizeRect(rect)

  const element = document.createElement('div')
  element.style.left = Math.floor(pageView.div.offsetLeft + left) + 'px'
  element.style.top = Math.floor(pageView.div.offsetTop + top) + 'px'
  element.style.width = Math.ceil(right - left) + 'px'
  element.style.height = Math.ceil(bottom - top) + 'px'
  element.style.backgroundColor = 'rgba(255,255,0)'
  element.style.position = 'absolute'
  element.style.display = 'inline-block'
  element.style.scrollMargin = '72px'
  element.style.pointerEvents = 'none'
  element.style.opacity = '0'
  element.style.transition = 'opacity 1s'

  viewer.viewer?.append(element)

  return element
}
