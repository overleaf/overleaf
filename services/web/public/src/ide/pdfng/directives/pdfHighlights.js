/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base', 'pdfjs-dist/build/pdf'], (App, PDFJS) =>
  // app = angular.module 'pdfHighlights', []

  App.factory('pdfHighlights', function() {
    let pdfHighlights
    return (pdfHighlights = class pdfHighlights {
      constructor(options) {
        this.highlightsLayerDiv = options.highlights[0]
        this.highlightElements = []
      }

      addHighlight(viewport, left, top, width, height) {
        let rect = viewport.convertToViewportRectangle([
          left,
          top,
          left + width,
          top + height
        ])
        rect = PDFJS.Util.normalizeRect(rect)
        const element = document.createElement('div')
        element.style.left = Math.floor(rect[0]) + 'px'
        element.style.top = Math.floor(rect[1]) + 'px'
        element.style.width = Math.ceil(rect[2] - rect[0]) + 'px'
        element.style.height = Math.ceil(rect[3] - rect[1]) + 'px'
        this.highlightElements.push(element)
        this.highlightsLayerDiv.appendChild(element)
        return element
      }

      clearHighlights() {
        for (let h of Array.from(this.highlightElements)) {
          if (h != null) {
            h.parentNode.removeChild(h)
          }
        }
        return (this.highlightElements = [])
      }
    })
  }))
