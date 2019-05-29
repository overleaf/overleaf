/* eslint-disable
    camelcase,
    max-len,
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
const ProjectDetailsHandler = require('./ProjectDetailsHandler')
const logger = require('logger-sharelatex')

module.exports = {
  getProjectDetails(req, res, next) {
    const { project_id } = req.params
    return ProjectDetailsHandler.getDetails(project_id, function(
      err,
      projDetails
    ) {
      if (err != null) {
        return next(err)
      }
      return res.json(projDetails)
    })
  }
}
