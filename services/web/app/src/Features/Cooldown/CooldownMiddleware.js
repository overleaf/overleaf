/* eslint-disable
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
let CooldownMiddleware
const CooldownManager = require('./CooldownManager')
const logger = require('logger-sharelatex')

module.exports = CooldownMiddleware = {
  freezeProject(req, res, next) {
    const projectId = req.params.Project_id
    if (projectId == null) {
      return next(new Error('[Cooldown] No projectId parameter on route'))
    }
    return CooldownManager.isProjectOnCooldown(projectId, function(
      err,
      projectIsOnCooldown
    ) {
      if (err != null) {
        return next(err)
      }
      if (projectIsOnCooldown) {
        logger.log(
          { projectId },
          '[Cooldown] project is on cooldown, denying request'
        )
        return res.sendStatus(429)
      }
      return next()
    })
  }
}
