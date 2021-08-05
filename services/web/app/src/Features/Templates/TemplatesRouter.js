const AuthenticationController = require('../Authentication/AuthenticationController')
const TemplatesController = require('./TemplatesController')
const TemplatesMiddleware = require('./TemplatesMiddleware')
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')
const AnalyticsRegistrationSourceMiddleware = require('../Analytics/AnalyticsRegistrationSourceMiddleware')

module.exports = {
  apply(app) {
    app.get(
      '/project/new/template/:Template_version_id',
      TemplatesMiddleware.saveTemplateDataInSession,
      AuthenticationController.requireLogin(),
      TemplatesController.getV1Template
    )

    app.post(
      '/project/new/template',
      AnalyticsRegistrationSourceMiddleware.setSource('template'),
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit({
        endpointName: 'create-project-from-template',
        maxRequests: 20,
        timeInterval: 60,
      }),
      TemplatesController.createProjectFromV1Template,
      AnalyticsRegistrationSourceMiddleware.clearSource()
    )
  },
}
