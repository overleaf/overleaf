/* eslint-disable
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'ide/pdf/controllers/PdfController',
  'ide/pdf/controllers/PdfViewToggleController',
  'ide/pdfng/directives/pdfJs'
], function() {
  let PdfManager
  return (PdfManager = class PdfManager {
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
        logEntries: [],
        logEntryAnnotations: {},
        rawLog: '',
        view: null, // 'pdf' 'logs'
        showRawLog: false,
        highlights: [],
        position: null
      }
    }
  })
})
