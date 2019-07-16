/* eslint-disable
    handle-callback-err,
    max-len,
    new-cap,
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
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base', 'pdfjs-dist/build/pdf'], (App, PDFJS) =>
  // App = angular.module 'PDFRenderer', ['pdfAnnotations', 'pdfTextLayer']

  App.factory('PDFRenderer', function(
    $q,
    $timeout,
    pdfAnnotations,
    pdfTextLayer,
    pdfSpinner
  ) {
    let PDFRenderer
    return (PDFRenderer = (function() {
      PDFRenderer = class PDFRenderer {
        static initClass() {
          this.prototype.JOB_QUEUE_INTERVAL = 25
          this.prototype.PAGE_LOAD_TIMEOUT = 60 * 1000
          this.prototype.INDICATOR_DELAY1 = 100 // time to delay before showing the indicator
          this.prototype.INDICATOR_DELAY2 = 250 // time until the indicator starts animating
          this.prototype.TEXTLAYER_TIMEOUT = 100
        }

        constructor(url, options) {
          // set up external character mappings - needed for Japanese etc
          this.url = url
          this.options = options

          this.scale = this.options.scale || 1

          let disableFontFace
          if (
            __guard__(
              window.location != null ? window.location.search : undefined,
              x => x.indexOf('disable-font-face=true')
            ) >= 0
          ) {
            disableFontFace = true
          } else {
            disableFontFace = false
          }
          this.pdfjs = PDFJS.getDocument({
            url: this.url,
            cMapUrl: window.pdfCMapsPath,
            cMapPacked: true,
            disableFontFace,
            // Enable fetching with Range headers to restrict individual
            // requests to 128kb.
            // To do this correctly we must:
            // a) disable auto-fetching of the whole file upfront
            // b) disable streaming (which in this context means streaming of
            // the response into memory). This isn't supported when using
            // Range headers, but shouldn't be a problem since we are already
            // limiting individual response size through chunked range
            // requests
            rangeChunkSize: 128 * 1024,
            disableAutoFetch: !!this.options.disableAutoFetch,
            disableStream: !!this.options.disableAutoFetch
          })
          this.pdfjs.onProgress = this.options.progressCallback
          this.document = $q.when(this.pdfjs)
          this.navigateFn = this.options.navigateFn
          this.spinner = new pdfSpinner()
          this.resetState()
          this.document.then(pdfDocument => {
            return pdfDocument.getDownloadInfo().then(() => {
              return this.options.loadedCallback()
            })
          })
          this.errorCallback = this.options.errorCallback
          this.pageSizeChangeCallback = this.options.pageSizeChangeCallback
          this.pdfjs.promise.catch(exception => {
            // error getting document
            return this.errorCallback(exception)
          })
        }

        resetState() {
          this.renderQueue = []
          if (this.queueTimer != null) {
            clearTimeout(this.queueTimer)
          }
          // clear any existing timers, render tasks
          for (let timer of Array.from(this.spinTimer || [])) {
            clearTimeout(timer)
          }
          for (let page of Array.from(this.pageState || [])) {
            __guard__(page != null ? page.loadTask : undefined, x => x.cancel())
            __guard__(page != null ? page.renderTask : undefined, x1 =>
              x1.cancel()
            )
          }
          // initialise/reset the state
          this.pageState = []
          this.spinTimer = [] // timers for starting the spinners (to avoid jitter)
          this.spinTimerDone = [] // array of pages where the spinner has activated
          return (this.jobs = 0)
        }

        getNumPages() {
          return this.document.then(pdfDocument => pdfDocument.numPages)
        }

        getPage(pageNum) {
          return this.document.then(pdfDocument => pdfDocument.getPage(pageNum))
        }

        getPdfViewport(pageNum, scale) {
          if (scale == null) {
            ;({ scale } = this)
          }
          return this.document.then(pdfDocument => {
            return pdfDocument.getPage(pageNum).then(
              function(page) {
                let viewport
                return (viewport = page.getViewport(scale))
              },
              error => {
                return typeof this.errorCallback === 'function'
                  ? this.errorCallback(error)
                  : undefined
              }
            )
          })
        }

        getDestinations() {
          return this.document.then(pdfDocument =>
            pdfDocument.getDestinations()
          )
        }

        getDestination(dest) {
          return this.document.then(
            pdfDocument => pdfDocument.getDestination(dest),
            error => {
              return typeof this.errorCallback === 'function'
                ? this.errorCallback(error)
                : undefined
            }
          )
        }

        getPageIndex(ref) {
          return this.document.then(pdfDocument => {
            return pdfDocument.getPageIndex(ref).then(
              idx => idx,
              error => {
                return typeof this.errorCallback === 'function'
                  ? this.errorCallback(error)
                  : undefined
              }
            )
          })
        }

        getScale() {
          return this.scale
        }

        setScale(scale) {
          this.scale = scale
          return this.resetState()
        }

        triggerRenderQueue(interval) {
          if (interval == null) {
            interval = this.JOB_QUEUE_INTERVAL
          }
          if (this.queueTimer != null) {
            clearTimeout(this.queueTimer)
          }
          return (this.queueTimer = setTimeout(() => {
            this.queueTimer = null
            return this.processRenderQueue()
          }, interval))
        }

        removeCompletedJob(pagenum) {
          this.jobs = this.jobs - 1
          return this.triggerRenderQueue(0)
        }

        renderPages(pages) {
          if (this.shuttingDown) {
            return
          }
          this.renderQueue = Array.from(pages).map(page => ({
            element: page.elementChildren,
            pagenum: page.pageNum
          }))
          return this.triggerRenderQueue()
        }

        renderPage(page) {
          if (this.shuttingDown) {
            return
          }
          const current = {
            element: page.elementChildren,
            pagenum: page.pageNum
          }
          this.renderQueue.push(current)
          return this.processRenderQueue()
        }

        getPageDetails(page) {
          return [page.element.canvas, page.pagenum]
        }

        // handle the loading indicators for each page

        startIndicators() {
          // make an array of the pages in the queue
          this.queuedPages = []
          for (var page of Array.from(this.renderQueue)) {
            this.queuedPages[page.pagenum] = true
          }
          // clear any unfinished spinner timers on pages that aren't in the queue any more
          for (let pagenum in this.spinTimer) {
            if (!this.queuedPages[pagenum]) {
              clearTimeout(this.spinTimer[pagenum])
              delete this.spinTimer[pagenum]
            }
          }
          // add indicators for any new pages in the current queue
          return (() => {
            const result = []
            for (page of Array.from(this.renderQueue)) {
              if (
                !this.spinTimer[page.pagenum] &&
                !this.spinTimerDone[page.pagenum]
              ) {
                result.push(this.startIndicator(page))
              }
            }
            return result
          })()
        }

        startIndicator(page) {
          const [canvas, pagenum] = Array.from(this.getPageDetails(page))
          canvas.addClass('pdfng-loading')
          return (this.spinTimer[pagenum] = setTimeout(() => {
            for (let queuedPage of Array.from(this.renderQueue)) {
              if (pagenum === queuedPage.pagenum) {
                this.spinner.add(canvas, { static: true })
                this.spinTimerDone[pagenum] = true
                break
              }
            }
            return delete this.spinTimer[pagenum]
          }, this.INDICATOR_DELAY1))
        }

        updateIndicator(page) {
          const [canvas, pagenum] = Array.from(this.getPageDetails(page))
          // did the spinner insert itself already?
          if (this.spinTimerDone[pagenum]) {
            return (this.spinTimer[pagenum] = setTimeout(() => {
              this.spinner.start(canvas)
              return delete this.spinTimer[pagenum]
            }, this.INDICATOR_DELAY2))
          } else {
            // stop the existing spin timer
            clearTimeout(this.spinTimer[pagenum])
            // start a new one which will also start spinning
            return (this.spinTimer[pagenum] = setTimeout(() => {
              this.spinner.add(canvas, { static: true })
              this.spinTimerDone[pagenum] = true
              return (this.spinTimer[pagenum] = setTimeout(() => {
                this.spinner.start(canvas)
                return delete this.spinTimer[pagenum]
              }, this.INDICATOR_DELAY2))
            }, this.INDICATOR_DELAY1))
          }
        }

        clearIndicator(page) {
          const [canvas, pagenum] = Array.from(this.getPageDetails(page))
          this.spinner.stop(canvas)
          clearTimeout(this.spinTimer[pagenum])
          delete this.spinTimer[pagenum]
          return (this.spinTimerDone[pagenum] = true)
        }

        // handle the queue of pages to be rendered

        processRenderQueue() {
          let pageState
          if (this.shuttingDown) {
            return
          }
          // mark all pages in the queue as loading
          this.startIndicators()
          // bail out if there is already a render job running
          if (this.jobs > 0) {
            return
          }
          // take the first page in the queue
          let page = this.renderQueue.shift()
          // check if it is in action already
          while (page != null && this.pageState[page.pagenum] != null) {
            page = this.renderQueue.shift()
          }
          if (page == null) {
            return
          }
          const [element, pagenum] = Array.from([page.element, page.pagenum])
          this.jobs = this.jobs + 1

          // update the spinner to make it spinning (signifies loading has begun)
          this.updateIndicator(page)

          let timedOut = false
          const timer = $timeout(() => {
            // page load timed out
            if (loadTask.cancelled) {
              return
            } // return from cancelled page load
            __guardMethod__(window.Raven, 'captureMessage', o =>
              o.captureMessage(
                `pdfng page load timed out after ${this.PAGE_LOAD_TIMEOUT}ms`
              )
            )
            timedOut = true
            this.clearIndicator(page)
            // @jobs = @jobs - 1
            // @triggerRenderQueue(0)
            return typeof this.errorCallback === 'function'
              ? this.errorCallback('timeout')
              : undefined
          }, this.PAGE_LOAD_TIMEOUT)

          var loadTask = this.getPage(pagenum)

          loadTask.cancel = function() {
            return (this.cancelled = true)
          }

          this.pageState[pagenum] = pageState = { loadTask }

          return loadTask
            .then(pageObject => {
              // page load success
              $timeout.cancel(timer)
              if (loadTask.cancelled) {
                return
              } // return from cancelled page load
              pageState.renderTask = this.doRender(element, pagenum, pageObject)
              return pageState.renderTask.then(
                () => {
                  // render task success
                  this.clearIndicator(page)
                  pageState.complete = true
                  delete pageState.renderTask
                  return this.removeCompletedJob(pagenum)
                },
                () => {
                  // render task failed
                  // could display an error icon
                  pageState.complete = false
                  delete pageState.renderTask
                  return this.removeCompletedJob(pagenum)
                }
              )
            })
            .catch(error => {
              // page load error
              $timeout.cancel(timer)
              return this.clearIndicator(page)
            })
        }

        doRender(element, pagenum, page) {
          const self = this
          const { scale } = this

          if (scale == null) {
            // scale is undefined, returning
            return
          }

          const canvas = $(
            '<canvas class="pdf-canvas pdfng-rendering"></canvas>'
          )
          // In Windows+IE we must have the canvas in the DOM during
          // rendering to see the fonts defined in the DOM. If we try to
          // render 'offscreen' then all the text will be sans-serif.
          // Previously we rendered offscreen and added in the canvas
          // when rendering was complete.
          element.canvas.replaceWith(canvas)

          const viewport = page.getViewport(scale)

          const devicePixelRatio = window.devicePixelRatio || 1

          const ctx = canvas[0].getContext('2d')
          const backingStoreRatio =
            ctx.webkitBackingStorePixelRatio ||
            ctx.mozBackingStorePixelRatio ||
            ctx.msBackingStorePixelRatio ||
            ctx.oBackingStorePixelRatio ||
            ctx.backingStorePixelRatio ||
            1
          const pixelRatio = devicePixelRatio / backingStoreRatio

          const scaledWidth = (Math.floor(viewport.width) * pixelRatio) | 0
          const scaledHeight = (Math.floor(viewport.height) * pixelRatio) | 0

          const newWidth = Math.floor(viewport.width)
          const newHeight = Math.floor(viewport.height)

          canvas[0].height = scaledHeight
          canvas[0].width = scaledWidth

          canvas.height(newHeight + 'px')
          canvas.width(newWidth + 'px')

          const oldHeight = element.canvas.height()
          const oldWidth = element.canvas.width()
          if (newHeight !== oldHeight || newWidth !== oldWidth) {
            element.canvas.height(newHeight + 'px')
            element.canvas.width(newWidth + 'px')
            element.container.height(newHeight + 'px')
            element.container.width(newWidth + 'px')
            if (typeof this.pageSizeChangeCallback === 'function') {
              this.pageSizeChangeCallback(pagenum, newHeight - oldHeight)
            }
          }

          const textLayer = new pdfTextLayer({
            textLayerDiv: element.text[0],
            viewport,
            renderer: PDFJS.renderTextLayer
          })

          const annotationsLayer = new pdfAnnotations({
            annotations: element.annotations[0],
            viewport,
            navigateFn: this.navigateFn
          })

          const result = page.render({
            canvasContext: ctx,
            viewport,
            transform: [pixelRatio, 0, 0, pixelRatio, 0, 0]
          })

          const textLayerTimeout = this.TEXTLAYER_TIMEOUT

          result
            .then(function() {
              // page render success
              canvas.removeClass('pdfng-rendering')
              page.getTextContent({ normalizeWhitespace: true }).then(
                function(textContent) {
                  textLayer.setTextContent(textContent)
                  return textLayer.render(textLayerTimeout)
                },
                error =>
                  typeof self.errorCallback === 'function'
                    ? self.errorCallback(error)
                    : undefined
              )
              return page
                .getAnnotations()
                .then(
                  annotations => annotationsLayer.setAnnotations(annotations),
                  error =>
                    typeof self.errorCallback === 'function'
                      ? self.errorCallback(error)
                      : undefined
                )
            })
            .catch(function(error) {
              // page render failed
              if (error.name === 'RenderingCancelledException') {
                // do nothing when cancelled
              } else {
                return typeof self.errorCallback === 'function'
                  ? self.errorCallback(error)
                  : undefined
              }
            })

          return result
        }

        destroy() {
          this.shuttingDown = true
          this.resetState()
          return this.pdfjs.then(function(document) {
            document.cleanup()
            return document.destroy()
          })
        }
      }
      PDFRenderer.initClass()
      return PDFRenderer
    })())
  }))

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
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
