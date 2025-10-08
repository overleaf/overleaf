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
import settings from '@overleaf/settings'

import logger from '@overleaf/logger'

export default {
  saveTemplateDataInSession(req, res, next) {
    if (req.query.templateName) {
      req.session.templateData = req.query
    }
    return next()
  },
}
