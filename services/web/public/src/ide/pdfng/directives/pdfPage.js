/* eslint-disable
    max-len,
    new-cap,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  // App = angular.module 'pdfPage', ['pdfHighlights']

  App.directive('pdfPage', ($timeout, pdfHighlights, pdfSpinner) => ({
    require: '^pdfViewer',
    template: `\
<div class="plv-page-view page-view">
	<div class="pdf-canvas pdfng-empty"></div>
	<div class="plv-text-layer text-layer"></div>
	<div class="plv-annotations-layer annotations-layer"></div>
	<div class="plv-highlights-layer highlights-layer"></div>
</div>\
`,
    link(scope, element, attrs, ctrl) {
      const canvasElement = $(element).find('.pdf-canvas')
      const textElement = $(element).find('.text-layer')
      const annotationsElement = $(element).find('.annotations-layer')
      const highlightsElement = $(element).find('.highlights-layer')

      const updatePageSize = function(size) {
        const h = Math.floor(size[0])
        const w = Math.floor(size[1])
        element.height(h)
        element.width(w)
        canvasElement.height(h)
        canvasElement.width(w)
        return (scope.page.sized = true)
      }

      // keep track of our page element, so we can access it in the
      // parent with scope.pages[i].element, and the contained
      // elements for each part
      scope.page.element = element
      scope.page.elementChildren = {
        canvas: canvasElement,
        text: textElement,
        annotations: annotationsElement,
        highlights: highlightsElement,
        container: element
      }

      if (!scope.page.sized) {
        if (scope.defaultPageSize != null) {
          updatePageSize(scope.defaultPageSize)
        } else {
          // shouldn't get here - the default page size should now
          // always be set before redraw is called
          var handler = scope.$watch('defaultPageSize', function(
            defaultPageSize
          ) {
            if (defaultPageSize == null) {
              return
            }
            updatePageSize(defaultPageSize)
            return handler()
          })
        }
      }

      if (scope.page.current) {
        // console.log 'we must scroll to this page', scope.page.pageNum, 'at position', scope.page.position
        // this is the current page, we want to scroll it into view
        // and render it immediately
        scope.document.renderPage(scope.page)
        ctrl.setPdfPosition(scope.page, scope.page.position)
      }

      element.on('dblclick', function(e) {
        const offset = $(element)
          .find('.pdf-canvas')
          .offset()
        const dx = e.pageX - offset.left
        const dy = e.pageY - offset.top
        return scope.document
          .getPdfViewport(scope.page.pageNum)
          .then(function(viewport) {
            const pdfPoint = viewport.convertToPdfPoint(dx, dy)
            const event = {
              page: scope.page.pageNum,
              x: pdfPoint[0],
              y: viewport.viewBox[3] - pdfPoint[1]
            }
            return scope.$emit('pdfDoubleClick', event)
          })
      })

      const highlightsLayer = new pdfHighlights({
        highlights: highlightsElement
      })

      scope.$on('pdf:highlights', function(event, highlights) {
        let h
        if (highlights == null) {
          return
        }
        if (!(highlights.length > 0)) {
          return
        }
        if (scope.timeoutHandler) {
          $timeout.cancel(scope.timeoutHandler)
          highlightsLayer.clearHighlights()
          scope.timeoutHandler = null
        }

        // console.log 'got highlight watch in pdfPage', scope.page
        const pageHighlights = (() => {
          const result = []
          for (h of Array.from(highlights)) {
            if (h.page === scope.page.pageNum) {
              result.push(h)
            }
          }
          return result
        })()
        if (!pageHighlights.length) {
          return
        }
        scope.document.getPdfViewport(scope.page.pageNum).then(viewport =>
          (() => {
            const result1 = []
            for (let hl of Array.from(pageHighlights)) {
              // console.log 'adding highlight', h, viewport
              const top = viewport.viewBox[3] - hl.v
              result1.push(
                highlightsLayer.addHighlight(
                  viewport,
                  hl.h,
                  top,
                  hl.width,
                  hl.height
                )
              )
            }
            return result1
          })()
        )
        return (scope.timeoutHandler = $timeout(function() {
          highlightsLayer.clearHighlights()
          return (scope.timeoutHandler = null)
        }, 1000))
      })

      return scope.$on('$destroy', function() {
        if (scope.timeoutHandler != null) {
          $timeout.cancel(scope.timeoutHandler)
          return highlightsLayer.clearHighlights()
        }
      })
    }
  })))
