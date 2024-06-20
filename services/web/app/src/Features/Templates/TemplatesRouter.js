const AuthenticationController = require('../Authentication/AuthenticationController')
const TemplatesController = require('./TemplatesController')
const TemplatesMiddleware = require('./TemplatesMiddleware')
const { RateLimiter } = require('../../infrastructure/RateLimiter')
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')
const AnalyticsRegistrationSourceMiddleware = require('../Analytics/AnalyticsRegistrationSourceMiddleware')

const rateLimiter = new RateLimiter('create-project-from-template', {
  points: 20,
  duration: 60,
})

module.exports = {
  rateLimiter,
  apply(app) {
    app.get(
      '/project/new/template/:Template_version_id',
      (req, res, next) =>
        AnalyticsRegistrationSourceMiddleware.setSource(
          'template',
          req.params.Template_version_id
        )(req, res, next),
      TemplatesMiddleware.saveTemplateDataInSession,
      AuthenticationController.requireLogin(),
      TemplatesController.getV1Template,
      AnalyticsRegistrationSourceMiddleware.clearSource()
    )

    app.post(
      '/project/new/template',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(rateLimiter),
      TemplatesController.createProjectFromV1Template
    )
  },
}
