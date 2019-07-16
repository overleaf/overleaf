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
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  // uses the PDFJS text layer renderer to provide invisible overlayed
  // text for searching

  App.factory('pdfTextLayer', function() {
    let pdfTextLayer
    return (pdfTextLayer = class pdfTextLayer {
      constructor(options) {
        this.textLayerDiv = options.textLayerDiv
        this.divContentDone = false
        this.viewport = options.viewport
        this.textDivs = []
        this.renderer = options.renderer
        this.renderingDone = false
      }

      render(timeout) {
        if (this.renderingDone || !this.divContentDone) {
          return
        }

        if (this.textLayerRenderTask != null) {
          this.textLayerRenderTask.cancel()
          this.textLayerRenderTask = null
        }

        this.textDivs = []
        const textLayerFrag = document.createDocumentFragment()

        this.textLayerRenderTask = this.renderer({
          textContent: this.textContent,
          container: textLayerFrag,
          viewport: this.viewport,
          textDivs: this.textDivs,
          timeout,
          enhanceTextSelection: this.enhanceTextSelection
        })

        const textLayerSuccess = () => {
          this.textLayerDiv.appendChild(textLayerFrag)
          return (this.renderingDone = true)
        }

        const textLayerFailure = function() {
          // canceled or failed to render text layer -- skipping errors
        }

        return this.textLayerRenderTask.promise.then(
          textLayerSuccess,
          textLayerFailure
        )
      }

      setTextContent(textContent) {
        if (this.textLayerRenderTask) {
          this.textLayerRenderTask.cancel()
          this.textLayerRenderTask = null
        }

        this.textContent = textContent
        return (this.divContentDone = true)
      }
    })
  }))
