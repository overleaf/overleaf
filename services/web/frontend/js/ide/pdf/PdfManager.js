/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import './controllers/PdfController'
import './controllers/PdfViewToggleController'
import '../pdfng/directives/pdfJs'

let PdfManager

export default PdfManager = class PdfManager {
  constructor(ide, $scope) {
    this.ide = ide
    this.$scope = $scope
    this.$scope.pdf = {
      url: null, // Pdf Url
      error: false, // Server error
      timeout: false, // Server timed out
      failure: false, // PDF failed to compile
      compiling: false,
      uncompiled: true,
      logEntries: {},
      logEntryAnnotations: {},
      rawLog: '',
      validation: {},
      view: null, // 'pdf' 'logs'
      showRawLog: false,
      highlights: [],
      position: null,
      lastCompileTimestamp: null
    }
  }
}
