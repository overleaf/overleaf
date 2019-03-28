/* eslint-disable
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base', 'fineuploader'], (App, qq) =>
  App.directive('fineUpload', $timeout => ({
    scope: {
      multiple: '=',
      endpoint: '@',
      templateId: '@',
      sizeLimit: '@',
      allowedExtensions: '=',
      onCompleteCallback: '=',
      onUploadCallback: '=',
      onValidateBatch: '=',
      onErrorCallback: '=',
      onSubmitCallback: '=',
      onCancelCallback: '=',
      autoUpload: '=',
      params: '=',
      control: '='
    },
    link(scope, element, attrs) {
      let autoUpload, validation
      const multiple = scope.multiple || false
      const { endpoint } = scope
      const { templateId } = scope
      if (scope.allowedExtensions != null) {
        validation = { allowedExtensions: scope.allowedExtensions }
      } else {
        validation = {}
      }
      if (scope.sizeLimit) {
        validation.sizeLimit = scope.sizeLimit
      }
      const maxConnections = scope.maxConnections || 1
      const onComplete = scope.onCompleteCallback || function() {}
      const onUpload = scope.onUploadCallback || function() {}
      const onError = scope.onErrorCallback || function() {}
      const onValidateBatch = scope.onValidateBatch || function() {}
      const onSubmit = scope.onSubmitCallback || function() {}
      const onCancel = scope.onCancelCallback || function() {}
      if (scope.autoUpload == null) {
        autoUpload = true
      } else {
        ;({ autoUpload } = scope)
      }
      const params = scope.params || {}
      params._csrf = window.csrfToken

      const q = new qq.FineUploader({
        element: element[0],
        multiple,
        autoUpload,
        disabledCancelForFormUploads: true,
        validation,
        maxConnections,
        request: {
          endpoint,
          forceMultipart: true,
          params,
          paramsInBody: false
        },
        callbacks: {
          onComplete,
          onUpload,
          onValidateBatch,
          onError,
          onSubmit,
          onCancel
        },
        template: templateId,
        failedUploadTextDisplay: {
          mode: 'custom',
          responseProperty: 'error'
        }
      })
      window.q = q
      if (scope.control != null) {
        scope.control.q = q
      }
      return q
    }
  })))
