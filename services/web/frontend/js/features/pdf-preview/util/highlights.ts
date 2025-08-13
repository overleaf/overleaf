import { PDFJS } from '@/features/pdf-preview/util/pdf-js'
import { PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import { HighlightData } from './types'

export function buildHighlightElement(
  highlight: HighlightData,
  viewer: PDFViewer
) {
  const { viewport, div } = viewer.getPageView(highlight.page - 1)

  // page coordinates from synctex
  const rectangle = {
    left: highlight.h,
    right: highlight.h + highlight.width,
    top: highlight.v,
    bottom: highlight.v + highlight.height,
  }

  // needed because PDF page origin is at the bottom left
  const viewBoxHeight = viewport.viewBox[3] + 10

  // account for scaling
  const viewportRectangle = viewport.convertToViewportRectangle([
    rectangle.left,
    viewBoxHeight - rectangle.bottom,
    rectangle.right,
    viewBoxHeight - rectangle.top,
  ])

  // flip top/bottom, left/right if needed
  const normalizedRectangle = PDFJS.Util.normalizeRect(viewportRectangle)

  const [left, top, right, bottom] = normalizedRectangle

  // restrict to within the page container
  const clampedRectangle = {
    left: Math.max(left, 0),
    right: Math.min(right, div.clientWidth),
    top: Math.max(top, 0),
    bottom: Math.min(bottom, div.clientHeight),
  }

  // convert to screen positions
  const positions = {
    left: div.offsetLeft + clampedRectangle.left,
    right: div.offsetLeft + clampedRectangle.right,
    top: div.offsetTop + clampedRectangle.top,
    bottom: div.offsetTop + clampedRectangle.bottom,
  }

  const element = document.createElement('div')
  element.style.position = 'absolute'
  element.style.left = Math.floor(positions.left) + 'px'
  element.style.top = Math.floor(positions.top) + 'px'
  element.style.width = Math.floor(positions.right - positions.left) + 'px'
  element.style.height = Math.floor(positions.bottom - positions.top) + 'px'
  element.style.backgroundColor = 'rgb(255,255,0)'
  element.style.display = 'inline-block'
  element.style.scrollMargin = '72px'
  element.style.pointerEvents = 'none'
  element.style.opacity = '0'
  element.style.transition = 'opacity 1s'

  viewer.viewer?.append(element)

  return element
}
