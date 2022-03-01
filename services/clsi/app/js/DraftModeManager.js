/* eslint-disable
    camelcase,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let DraftModeManager
const fs = require('fs')
const logger = require('@overleaf/logger')

module.exports = DraftModeManager = {
  injectDraftMode(filename, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return fs.readFile(filename, 'utf8', function (error, content) {
      if (error != null) {
        return callback(error)
      }
      // avoid adding draft mode more than once
      if (
        (content != null
          ? content.indexOf('\\documentclass[draft')
          : undefined) >= 0
      ) {
        return callback()
      }
      const modified_content = DraftModeManager._injectDraftOption(content)
      logger.log(
        {
          content: content.slice(0, 1024), // \documentclass is normally v near the top
          modified_content: modified_content.slice(0, 1024),
          filename,
        },
        'injected draft class'
      )
      return fs.writeFile(filename, modified_content, callback)
    })
  },

  _injectDraftOption(content) {
    return (
      content
        // With existing options (must be first, otherwise both are applied)
        .replace(/\\documentclass\[/g, '\\documentclass[draft,')
        // Without existing options
        .replace(/\\documentclass\{/g, '\\documentclass[draft]{')
    )
  },
}
