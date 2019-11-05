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
define([], function() {
  let SafariScrollPatcher
  return (SafariScrollPatcher = class SafariScrollPatcher {
    constructor($scope) {
      this.isOverAce = false // Flag to control if the pointer is over Ace.
      this.pdfDiv = null
      this.aceDiv = null

      // Start listening to PDF wheel events when the pointer leaves the PDF region.
      // P.S. This is the problem in a nutshell: although the pointer is elsewhere,
      // wheel events keep being dispatched to the PDF.
      this.handlePdfDivMouseLeave = () => {
        return this.pdfDiv.addEventListener('wheel', this.dispatchToAce)
      }

      // Stop listening to wheel events when the pointer enters the PDF region. If
      // the pointer is over the PDF, native behaviour is adequate.
      this.handlePdfDivMouseEnter = () => {
        return this.pdfDiv.removeEventListener('wheel', this.dispatchToAce)
      }

      // Set the "pointer over Ace" flag as false, when the mouse leaves its area.
      this.handleAceDivMouseLeave = () => {
        return (this.isOverAce = false)
      }

      // Set the "pointer over Ace" flag as true, when the mouse enters its area.
      this.handleAceDivMouseEnter = () => {
        return (this.isOverAce = true)
      }

      // Grab the elements (pdfDiv, aceDiv) and set the "hover" event listeners.
      // If elements are already defined, clear existing event listeners and do
      // the process again (grab elements, set listeners).
      this.setListeners = () => {
        this.isOverAce = false

        // If elements aren't null, remove existing listeners.
        if (this.pdfDiv != null) {
          this.pdfDiv.removeEventListener(this.handlePdfDivMouseLeave)
          this.pdfDiv.removeEventListener(this.handlePdfDivMouseEnter)
        }

        if (this.aceDiv != null) {
          this.aceDiv.removeEventListener(this.handleAceDivMouseLeave)
          this.aceDiv.removeEventListener(this.handleAceDivMouseEnter)
        }

        // Grab elements.
        this.pdfDiv = document.querySelector('.pdfjs-viewer') // Grab the PDF div.
        this.aceDiv = document.querySelector('.ace_content') // Also the editor.

        // Set hover-related listeners.
        this.pdfDiv.addEventListener('mouseleave', this.handlePdfDivMouseLeave)
        this.pdfDiv.addEventListener('mouseenter', this.handlePdfDivMouseEnter)
        this.aceDiv.addEventListener('mouseleave', this.handleAceDivMouseLeave)
        return this.aceDiv.addEventListener(
          'mouseenter',
          this.handleAceDivMouseEnter
        )
      }

      // Handler for wheel events on the PDF.
      // If the pointer is over Ace, grab the event, prevent default behaviour
      // and dispatch it to Ace.
      this.dispatchToAce = e => {
        if (this.isOverAce) {
          // If this is logged, the problem just happened: the event arrived
          // here (the PDF wheel handler), but it should've gone to Ace.

          // Small timeout - if we dispatch immediately, an exception is thrown.
          window.setTimeout(() => {
            // Dispatch the exact same event to Ace (this will keep values
            // values e.g. `wheelDelta` consistent with user interaction).
            return this.aceDiv.dispatchEvent(e)
          }, 1)

          // Avoid scrolling the PDF, as we assume this was intended to the
          // editor.
          return e.preventDefault()
        }
      }

      // "loaded" event is emitted from the pdfViewer controller $scope. This means
      // that the previous PDF DOM element was destroyed and a new one is available,
      // so we need to grab the elements and set the listeners again.
      $scope.$on('loaded', () => {
        return this.setListeners()
      })
    }
  })
})
