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
const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')

module.exports = {
  saveTemplateDataInSession(req, res, next) {
    if (req.query.templateName) {
      req.session.templateData = req.query
    }
    return next()
  }
}
