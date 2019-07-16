/* eslint-disable
    max-len,
    no-undef,
    no-unused-vars,
    no-useless-constructor,
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
  App.factory('pdfSpinner', function() {
    let pdfSpinner
    return (pdfSpinner = class pdfSpinner {
      constructor() {}
      // handler for spinners

      add(element, options) {
        const size = 64
        const spinner = $(
          `<div class="pdfng-spinner" style="position: absolute; top: 50%; left:50%; transform: translateX(-50%) translateY(-50%);"><i class="fa fa-spinner${
            (options != null ? options.static : undefined) ? '' : ' fa-spin'
          }" style="color: #999"></i></div>`
        )
        spinner.css({ 'font-size': size + 'px' })
        return element.append(spinner)
      }

      start(element) {
        return element.find('.fa-spinner').addClass('fa-spin')
      }

      stop(element) {
        return element.find('.fa-spinner').removeClass('fa-spin')
      }

      remove(element) {
        return element.find('.fa-spinner').remove()
      }
    })
  }))
