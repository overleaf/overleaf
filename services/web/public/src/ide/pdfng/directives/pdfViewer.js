/* eslint-disable
    handle-callback-err,
    max-len,
    new-cap,
    no-return-assign,
    no-sequences,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'base',
  'ide/pdfng/directives/pdfTextLayer',
  'ide/pdfng/directives/pdfAnnotations',
  'ide/pdfng/directives/pdfHighlights',
  'ide/pdfng/directives/pdfRenderer',
  'ide/pdfng/directives/pdfPage',
  'ide/pdfng/directives/pdfSpinner'
], function(
  App,
  pdfTextLayer,
  pdfAnnotations,
  pdfHighlights,
  pdfRenderer,
  pdfPage,
  pdfSpinner,
  pdf
) {
  // App = angular.module 'pdfViewerApp', ['pdfPage', 'PDFRenderer', 'pdfHighlights']

  App.controller('pdfViewerController', function(
    $scope,
    $q,
    $timeout,
    PDFRenderer,
    $element,
    pdfHighlights,
    pdfSpinner
  ) {
    this.load = function() {
      // $scope.pages = []

      if ($scope.document != null) {
        $scope.document.destroy()
      }
      $scope.loadCount = $scope.loadCount != null ? $scope.loadCount + 1 : 1
      // TODO need a proper url manipulation library to add to query string
      let url = $scope.pdfSrc
      // add 'pdfng=true' to show that we are using the angular pdfjs viewer
      const queryStringExists = /\?/.test(url)
      url = url + (!queryStringExists ? '?' : '&') + 'pdfng=true'
      // for isolated compiles, load the pdf on-demand because nobody will overwrite it
      const onDemandLoading = true
      $scope.document = new PDFRenderer(url, {
        scale: 1,
        disableAutoFetch: onDemandLoading ? true : undefined,
        navigateFn(ref) {
          // this function captures clicks on the annotation links
          $scope.navigateTo = ref
          return $scope.$apply()
        },
        progressCallback(progress) {
          return $scope.$emit('progress', progress)
        },
        loadedCallback() {
          return $scope.$emit('loaded')
        },
        errorCallback(error) {
          __guardMethod__(window.Raven, 'captureMessage', o =>
            o.captureMessage(`pdfng error ${error}`)
          )
          return $scope.$emit('pdf:error', error)
        },
        pageSizeChangeCallback(pageNum, deltaH) {
          return $scope.$broadcast('pdf:page:size-change', pageNum, deltaH)
        }
      })

      // we will have all the main information needed to start display
      // after the following promise is resolved
      return ($scope.loaded = $q
        .all({
          numPages: $scope.document.getNumPages(),
          // get size of first page as default @ scale 1
          pdfViewport: $scope.document.getPdfViewport(1, 1)
        })
        .then(function(result) {
          $scope.pdfViewport = result.pdfViewport
          $scope.pdfPageSize = [
            result.pdfViewport.height,
            result.pdfViewport.width
          ]
          // console.log 'resolved q.all, page size is', result
          $scope.$emit('loaded')
          return ($scope.numPages = result.numPages)
        })
        .catch(function(error) {
          $scope.$emit('pdf:error', error)
          return $q.reject(error)
        }))
    }

    this.setScale = (scale, containerHeight, containerWidth) =>
      $scope.loaded
        .then(function() {
          let numScale
          if (scale == null) {
            scale = {}
          }
          if (containerHeight === 0 || containerWidth === 0) {
            numScale = 1
          } else if (scale.scaleMode === 'scale_mode_fit_width') {
            // TODO make this dynamic
            numScale = (containerWidth - 40) / $scope.pdfPageSize[1]
          } else if (scale.scaleMode === 'scale_mode_fit_height') {
            // TODO magic numbers for jquery ui layout
            numScale = (containerHeight - 20) / $scope.pdfPageSize[0]
          } else if (scale.scaleMode === 'scale_mode_value') {
            numScale = scale.scale
          } else if (scale.scaleMode === 'scale_mode_auto') {
            // TODO
          } else {
            scale.scaleMode = 'scale_mode_fit_width'
            numScale = (containerWidth - 40) / $scope.pdfPageSize[1]
          }
          // TODO
          $scope.scale.scale = numScale
          $scope.document.setScale(numScale)
          return ($scope.defaultPageSize = [
            numScale * $scope.pdfPageSize[0],
            numScale * $scope.pdfPageSize[1]
          ])
        })
        // console.log 'in setScale result', $scope.scale.scale, $scope.defaultPageSize
        .catch(function(error) {
          $scope.$emit('pdf:error', error)
          return $q.reject(error)
        })

    this.redraw = function(position) {
      // console.log 'in redraw'
      // console.log 'reseting pages array for', $scope.numPages
      $scope.pages = __range__(0, $scope.numPages - 1, true).map(i => ({
        pageNum: i + 1
      }))
      if (position != null && position.page != null) {
        // console.log 'position is', position.page, position.offset
        // console.log 'setting current page', position.page
        let pagenum = position.page
        if (pagenum > $scope.numPages - 1) {
          pagenum = $scope.numPages - 1
        }
        $scope.pages[pagenum].current = true
        return ($scope.pages[pagenum].position = position)
      }
    }

    this.zoomIn = function() {
      // console.log 'zoom in'
      const newScale = $scope.scale.scale * 1.2
      return ($scope.forceScale = {
        scaleMode: 'scale_mode_value',
        scale: newScale
      })
    }

    this.zoomOut = function() {
      // console.log 'zoom out'
      const newScale = $scope.scale.scale / 1.2
      return ($scope.forceScale = {
        scaleMode: 'scale_mode_value',
        scale: newScale
      })
    }

    this.fitWidth = () =>
      // console.log 'fit width'
      ($scope.forceScale = { scaleMode: 'scale_mode_fit_width' })

    this.fitHeight = () =>
      // console.log 'fit height'
      ($scope.forceScale = { scaleMode: 'scale_mode_fit_height' })

    this.checkPosition = () =>
      // console.log 'check position'
      ($scope.forceCheck = ($scope.forceCheck || 0) + 1)

    this.showRandomHighlights = () =>
      // console.log 'show highlights'
      ($scope.highlights = [
        {
          page: 3,
          h: 100,
          v: 100,
          height: 30,
          width: 200
        }
      ])

    // we work with (pagenumber, % of height down page from top)
    // pdfListView works with (pagenumber, vertical position up page from
    // bottom measured in pts)

    this.getPdfPosition = function() {
      // console.log 'in getPdfPosition'
      let canvasOffset, pdfOffset, viewport
      let topPageIdx = 0
      let topPage = $scope.pages[0]
      // find first visible page
      const visible = $scope.pages.some(function(page, i) {
        if (page.visible) {
          let ref
          return ([topPageIdx, topPage] = Array.from((ref = [i, page]))), ref
        }
      })
      if (visible && topPage.element != null) {
        // console.log 'found it', topPageIdx
      } else {
        // console.log 'CANNOT FIND TOP PAGE'
        return
      }

      // console.log 'top page is', topPage.pageNum, topPage.elemTop, topPage.elemBottom, topPage
      const { top } = topPage.element.offset()
      const bottom = top + topPage.element.innerHeight()
      const viewportTop = $element.offset().top
      const viewportBottom = viewportTop + $element.height()
      const topVisible = top >= viewportTop && top < viewportBottom
      const someContentVisible = top < viewportTop && bottom > viewportTop
      // console.log 'in PdfListView', top, topVisible, someContentVisible, viewportTop
      if (topVisible) {
        canvasOffset = 0
      } else if (someContentVisible) {
        canvasOffset = viewportTop - top
      } else {
        canvasOffset = null
      }
      // console.log 'pdfListview position = ', canvasOffset
      // instead of using promise, check if size is known and revert to
      // default otherwise
      // console.log 'looking up viewport', topPage.viewport, $scope.pdfViewport
      if (topPage.viewport) {
        ;({ viewport } = topPage)
        pdfOffset = viewport.convertToPdfPoint(0, canvasOffset)
      } else {
        // console.log 'WARNING: had to default to global page size'
        viewport = $scope.pdfViewport
        const scaledOffset = canvasOffset / $scope.scale.scale
        pdfOffset = viewport.convertToPdfPoint(0, scaledOffset)
      }
      // console.log 'converted to offset = ', pdfOffset
      const newPosition = {
        page: topPageIdx,
        offset: { top: pdfOffset[1], left: 0 },
        pageSize: { height: viewport.viewBox[3], width: viewport.viewBox[2] }
      }
      return newPosition
    }

    this.computeOffset = function(page, position) {
      // console.log 'computing offset for', page, position
      const { element } = page
      // console.log 'element =', $(element), 'parent =', $(element).parent()
      const t1 = __guard__($(element).offset(), x => x.top)
      const t2 = __guard__(
        $(element)
          .parent()
          .offset(),
        x1 => x1.top
      )
      if (!(t1 != null && t2 != null)) {
        return $q((resolve, reject) => reject('elements destroyed'))
      }
      const pageTop =
        $(element).offset().top -
        $(element)
          .parent()
          .offset().top
      // console.log('top of page scroll is', pageTop, 'vs', page.elemTop)
      // console.log('inner height is', $(element).innerHeight())
      const currentScroll = $(element)
        .parent()
        .scrollTop()
      const { offset } = position
      // convert offset to pixels
      return $scope.document
        .getPdfViewport(page.pageNum)
        .then(function(viewport) {
          page.viewport = viewport
          const pageOffset = viewport.convertToViewportPoint(
            offset.left,
            offset.top
          )
          // if the passed-in position doesn't have the page height/width add them now
          if (position.pageSize == null) {
            position.pageSize = {
              height: viewport.viewBox[3],
              width: viewport.viewBox[2]
            }
          }
          // console.log 'addition offset =', pageOffset
          // console.log 'total', pageTop + pageOffset[1]
          return Math.round(pageTop + pageOffset[1] + currentScroll)
        }) // # 10 is margin
    }

    this.setPdfPosition = function(page, position) {
      // console.log 'required pdf Position is', position
      return this.computeOffset(page, position).then(function(offset) {
        $scope.pleaseScrollTo = offset
        return ($scope.position = position)
      })
    }

    return this
  })

  return App.directive('pdfViewer', ($q, $timeout, pdfSpinner) => ({
    controller: 'pdfViewerController',
    controllerAs: 'ctrl',
    scope: {
      pdfSrc: '=',
      highlights: '=',
      position: '=',
      scale: '=',
      pleaseJumpTo: '='
    },
    template: `\
<div data-pdf-page class='pdf-page-container page-container' ng-repeat='page in pages'></div>\
`,
    link(scope, element, attrs, ctrl) {
      // console.log 'in pdfViewer element is', element
      // console.log 'attrs', attrs
      const spinner = new pdfSpinner()
      let layoutReady = $q.defer()
      layoutReady.notify('waiting for layout')
      layoutReady.promise.then(function() {})
      // console.log 'layoutReady was resolved'

      const renderVisiblePages = function() {
        const visiblePages = getVisiblePages()
        const pages = getExtraPages(visiblePages)
        return scope.document.renderPages(pages)
      }

      var getVisiblePages = function() {
        const top = element[0].scrollTop
        const bottom = top + element[0].clientHeight
        const visiblePages = _.filter(scope.pages, function(page) {
          if (page.element == null) {
            return false
          }
          const pageElement = page.element[0]
          const pageTop = pageElement.offsetTop
          const pageBottom = pageTop + pageElement.clientHeight
          page.visible = pageTop < bottom && pageBottom > top
          return page.visible
        })
        return visiblePages
      }

      var getExtraPages = function(visiblePages) {
        const extra = []
        if (visiblePages.length > 0) {
          const firstVisiblePage = visiblePages[0].pageNum
          const firstVisiblePageIdx = firstVisiblePage - 1
          const len = visiblePages.length
          const lastVisiblePage = visiblePages[len - 1].pageNum
          const lastVisiblePageIdx = lastVisiblePage - 1
          // first page after
          if (lastVisiblePageIdx + 1 < scope.pages.length) {
            extra.push(scope.pages[lastVisiblePageIdx + 1])
          }
          // page before
          if (firstVisiblePageIdx > 0) {
            extra.push(scope.pages[firstVisiblePageIdx - 1])
          }
          // second page after
          if (lastVisiblePageIdx + 2 < scope.pages.length) {
            extra.push(scope.pages[lastVisiblePageIdx + 2])
          }
        }
        return visiblePages.concat(extra)
      }

      let rescaleTimer = null
      const queueRescale = function(scale) {
        // console.log 'call to queueRescale'
        if (
          rescaleTimer != null ||
          layoutTimer != null ||
          elementTimer != null
        ) {
          return
        }
        // console.log 'adding to rescale queue'
        return (rescaleTimer = setTimeout(function() {
          doRescale(scale)
          return (rescaleTimer = null)
        }, 0))
      }

      let spinnerTimer = null
      var doRescale = function(scale) {
        // console.log 'doRescale', scale
        if (scale == null) {
          return
        }
        const origposition = angular.copy(scope.position)
        // console.log 'origposition', origposition

        if (spinnerTimer == null) {
          spinnerTimer = setTimeout(function() {
            spinner.add(element)
            return (spinnerTimer = null)
          }, 100)
        }
        return layoutReady.promise.then(function(parentSize) {
          const [h, w] = Array.from(parentSize)
          // console.log 'in promise', h, w
          return ctrl
            .setScale(scale, h, w)
            .then(() =>
              // console.log 'in setscale then', scale, h, w
              scope.$evalAsync(function() {
                if (spinnerTimer) {
                  clearTimeout(spinnerTimer)
                } else {
                  spinner.remove(element)
                }
                // stop displaying the text layer
                element.removeClass('pdfjs-viewer-show-text')
                ctrl.redraw(origposition)
                $timeout(renderVisiblePages)
                return (scope.loadSuccess = true)
              })
            )
            .catch(error => scope.$emit('pdf:error', error))
        })
      }

      var elementTimer = null
      var updateLayout = function() {
        // if element is zero-sized keep checking until it is ready
        // console.log 'checking element ready', element.height(), element.width()
        if (element.height() === 0 || element.width() === 0) {
          if (elementTimer != null) {
            return
          }
          return (elementTimer = setTimeout(function() {
            elementTimer = null
            return updateLayout()
          }, 1000))
        } else {
          scope.parentSize = [element.innerHeight(), element.innerWidth()]
          // console.log 'resolving layoutReady with', scope.parentSize
          return $timeout(function() {
            layoutReady.resolve(scope.parentSize)
            return scope.$emit('flash-controls')
          })
        }
      }

      var layoutTimer = null
      const queueLayout = function() {
        // console.log 'call to queue layout'
        if (layoutTimer != null) {
          return
        }
        // console.log 'added to queue layoyt'
        layoutReady = $q.defer()
        return (layoutTimer = setTimeout(function() {
          // console.log 'calling update layout'
          updateLayout()
          // console.log 'setting layout timer to null'
          return (layoutTimer = null)
        }, 0))
      }

      queueLayout()

      // scope.$on 'layout:pdf:view', (e, args) ->
      //	console.log 'pdf view change', element, e, args
      //	queueLayout()

      scope.$on('layout:main:resize', () =>
        // console.log 'GOT LAYOUT-MAIN-RESIZE EVENT'
        queueLayout()
      )

      scope.$on('layout:pdf:resize', () =>
        // FIXME we get this event twice
        // also we need to start a new layout when we get it
        // console.log 'GOT LAYOUT-PDF-RESIZE EVENT'
        queueLayout()
      )

      scope.$on('pdf:error', function(event, error) {
        if (error.name === 'RenderingCancelledException') {
          return
        }
        // check if too many retries or file is missing
        const message = (error != null ? error.message : undefined) || error
        if (
          scope.loadCount > 3 ||
          /^Missing PDF/i.test(message) ||
          /^loading/i.test(message)
        ) {
          scope.$emit('pdf:error:display')
          return
        }
        if (scope.loadSuccess) {
          return ctrl
            .load()
            .then(
              () =>
                // trigger a redraw
                (scope.scale = angular.copy(scope.scale))
            )
            .catch(error => scope.$emit('pdf:error:display'))
        } else {
          scope.$emit('pdf:error:display')
        }
      })

      scope.$on('pdf:page:size-change', function(event, pageNum, delta) {
        // console.log 'page size change event', pageNum, delta
        const origposition = angular.copy(scope.position)
        // console.log 'orig position', JSON.stringify(origposition)
        if (
          origposition != null &&
          pageNum - 1 < origposition.page &&
          delta !== 0
        ) {
          const currentScrollTop = element.scrollTop()
          // console.log 'adjusting scroll from', currentScrollTop, 'by', delta
          scope.adjustingScroll = true
          return element.scrollTop(currentScrollTop + delta)
        }
      })

      element.on('mousedown', function(e) {
        // We're checking that the event target isn't the directive root element
        // to make sure that the click was within a PDF page - no point in showing
        // the text layer when the click is outside.
        // If the user clicks a PDF page, the mousedown target will be the canvas
        // element (or the text layer one). Alternatively, if the event target is
        // the root element, we can assume that the user has clicked either the
        // grey background area or the scrollbars.
        if (e.target !== element[0] && !_hasSelection()) {
          element.addClass('pdfjs-viewer-show-text')
          return _setMouseUpHandler()
        }
      })

      let mouseUpHandler = null // keep track of the handler to avoid adding multiple times

      var _setMouseUpHandler = function() {
        if (mouseUpHandler == null) {
          return (mouseUpHandler = $(document.body).one(
            'mouseup',
            _handleSelectionMouseUp
          ))
        }
      }

      var _handleSelectionMouseUp = function() {
        mouseUpHandler = null // reset handler, has now fired
        window.setTimeout(function() {
          const removedClass = _removeClassIfNoSelection()
          // if we still have a selection we need to keep the handler going
          if (!removedClass) {
            return _setMouseUpHandler()
          }
        }, 10)
        return true
      }

      var _removeClassIfNoSelection = function() {
        if (_hasSelection()) {
          return false // didn't remove the text layer
        } else {
          element.removeClass('pdfjs-viewer-show-text')
          return true
        }
      }

      var _hasSelection = function() {
        const selection =
          typeof window.getSelection === 'function'
            ? window.getSelection()
            : undefined
        // check the selection collapsed state in preference to
        // using selection.toString() as the latter is "" when
        // the selection is hidden (e.g. while viewing logs)
        return (
          selection != null &&
          _isSelectionWithinPDF(selection) &&
          !selection.isCollapsed
        )
      }

      var _isSelectionWithinPDF = function(selection) {
        if (selection.rangeCount === 0) {
          return false
        }
        const selectionAncestorNode = selection.getRangeAt(0)
          .commonAncestorContainer
        return (
          element.find(selectionAncestorNode).length > 0 ||
          element.is(selectionAncestorNode)
        )
      }

      element.on('scroll', function() {
        // console.log 'scroll event', element.scrollTop(), 'adjusting?', scope.adjustingScroll
        // scope.scrollPosition = element.scrollTop()
        if (scope.adjustingScroll) {
          renderVisiblePages()
          scope.adjustingScroll = false
          return
        }
        if (scope.scrollHandlerTimeout) {
          clearTimeout(scope.scrollHandlerTimeout)
        }
        return (scope.scrollHandlerTimeout = setTimeout(scrollHandler, 25))
      })

      var scrollHandler = function() {
        renderVisiblePages()
        const newPosition = ctrl.getPdfPosition()
        if (newPosition != null) {
          scope.position = newPosition
        }
        return (scope.scrollHandlerTimeout = null)
      }

      scope.$watch('pdfSrc', function(newVal, oldVal) {
        // console.log 'loading pdf', newVal, oldVal
        if (newVal == null) {
          return
        }
        scope.loadCount = 0 // new pdf, so reset load count
        scope.loadSuccess = false
        return ctrl
          .load()
          .then(
            () =>
              // trigger a redraw
              (scope.scale = angular.copy(scope.scale))
          )
          .catch(error => scope.$emit('pdf:error', error))
      })

      scope.$watch('scale', function(newVal, oldVal) {
        // no need to set scale when initialising, done in pdfSrc
        if (newVal === oldVal) {
          return
        }
        // console.log 'XXX calling Setscale in scale watch'
        return queueRescale(newVal)
      })

      scope.$watch('forceScale', function(newVal, oldVal) {
        // console.log 'got change in numscale watcher', newVal, oldVal
        if (newVal == null) {
          return
        }
        return queueRescale(newVal)
      })

      //				scope.$watch 'position', (newVal, oldVal) ->
      //					console.log 'got change in position watcher', newVal, oldVal

      scope.$watch('forceCheck', function(newVal, oldVal) {
        // console.log 'forceCheck', newVal, oldVal
        if (newVal == null) {
          return
        }
        scope.adjustingScroll = true // temporarily disable scroll
        return queueRescale(scope.scale)
      })

      scope.$watch(
        'parentSize',
        function(newVal, oldVal) {
          // console.log 'XXX in parentSize watch', newVal, oldVal
          // if newVal == oldVal
          // 	console.log 'returning because old and new are the same'
          // 	return
          // return unless oldVal?
          // console.log 'XXX calling setScale in parentSize watcher'
          if (newVal == null) {
            return
          }
          return queueRescale(scope.scale)
        },
        true
      )

      // scope.$watch 'elementWidth', (newVal, oldVal) ->
      // 	console.log '*** watch INTERVAL element width is', newVal, oldVal

      scope.$watch('pleaseScrollTo', function(newVal, oldVal) {
        // console.log 'got request to ScrollTo', newVal, 'oldVal', oldVal
        if (newVal == null) {
          return
        }
        scope.adjustingScroll = true // temporarily disable scroll
        // handler while we reposition
        $(element).scrollTop(newVal)
        return (scope.pleaseScrollTo = undefined)
      })

      scope.$watch('pleaseJumpTo', function(newPosition, oldPosition) {
        // console.log 'in pleaseJumpTo', newPosition, oldPosition
        if (newPosition == null) {
          return
        }
        return ctrl.setPdfPosition(
          scope.pages[newPosition.page - 1],
          newPosition
        )
      })

      scope.$watch('navigateTo', function(newVal, oldVal) {
        if (newVal == null) {
          return
        }
        // console.log 'got request to navigate to', newVal, 'oldVal', oldVal
        scope.navigateTo = undefined
        // console.log 'navigate to', newVal
        // console.log 'look up page num'
        return scope.document.getDestination(newVal.dest).then(r =>
          // console.log 'need to go to', r
          // console.log 'page ref is', r[0]
          scope.document.getPageIndex(r[0]).then(function(pidx) {
            // console.log 'page num is', pidx
            const page = scope.pages[pidx]
            return scope.document
              .getPdfViewport(page.pageNum)
              .then(function(viewport) {
                // console.log 'got viewport', viewport
                const coords = viewport.convertToViewportPoint(r[2], r[3])
                // console.log	'viewport position', coords
                // console.log 'r is', r, 'r[1]', r[1], 'r[1].name', r[1].name
                if (r[1].name === 'XYZ') {
                  // console.log 'XYZ:', r[2], r[3]
                  const newPosition = {
                    page: pidx,
                    offset: { top: r[3], left: r[2] }
                  }
                  return ctrl.setPdfPosition(scope.pages[pidx], newPosition)
                }
              })
          })
        )
      }) // XXX?

      scope.$watch('highlights', function(areas) {
        // console.log 'got HIGHLIGHTS in pdfViewer', areas
        if (areas == null) {
          return
        }
        // console.log 'areas are', areas
        const highlights = Array.from(areas || []).map(area => ({
          page: area.page - 1,
          highlight: {
            left: area.h,
            top: area.v,
            height: area.height,
            width: area.width
          }
        }))
        // console.log 'highlights', highlights

        if (!highlights.length) {
          return
        }

        scope.$broadcast('pdf:highlights', areas)

        const first = highlights[0]

        // switching between split and full pdf views can cause
        // highlights to appear before rendering
        if (!scope.pages) {
          return // ignore highlight scroll if still rendering
        }

        const pageNum =
          scope.pages[first.page] != null
            ? scope.pages[first.page].pageNum
            : undefined

        if (pageNum == null) {
          return // ignore highlight scroll if page not found
        }

        // use a visual offset of 72pt to match the offset in PdfController syncToCode
        return scope.document.getPdfViewport(pageNum).then(function(viewport) {
          const position = {
            page: first.page,
            offset: {
              left: first.highlight.left,
              top:
                viewport.viewBox[3] -
                first.highlight.top +
                first.highlight.height +
                72
            }
          }
          return ctrl.setPdfPosition(scope.pages[first.page], position)
        })
      })

      return scope.$on('$destroy', function() {
        // console.log 'handle pdfng directive destroy'
        if (elementTimer != null) {
          clearTimeout(elementTimer)
        }
        if (layoutTimer != null) {
          clearTimeout(layoutTimer)
        }
        if (rescaleTimer != null) {
          clearTimeout(rescaleTimer)
        }
        if (spinnerTimer != null) {
          return clearTimeout(spinnerTimer)
        }
      })
    }
  }))
})

function __guardMethod__(obj, methodName, transform) {
  if (
    typeof obj !== 'undefined' &&
    obj !== null &&
    typeof obj[methodName] === 'function'
  ) {
    return transform(obj, methodName)
  } else {
    return undefined
  }
}
function __range__(left, right, inclusive) {
  let range = []
  let ascending = left < right
  let end = !inclusive ? right : ascending ? right + 1 : right - 1
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i)
  }
  return range
}
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
