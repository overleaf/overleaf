/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const AuthenticationController = require('../Authentication/AuthenticationController')
const TemplatesController = require('./TemplatesController')
const TemplatesMiddleware = require('./TemplatesMiddleware')
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')

module.exports = {
  apply(app) {
    app.get(
      '/project/new/template/:Template_version_id',
      TemplatesMiddleware.saveTemplateDataInSession,
      AuthenticationController.requireLogin(),
      TemplatesController.getV1Template
    )

    return app.post(
      '/project/new/template',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit({
        endpointName: 'create-project-from-template',
        maxRequests: 20,
        timeInterval: 60
      }),
      TemplatesController.createProjectFromV1Template
    )
  }
}
