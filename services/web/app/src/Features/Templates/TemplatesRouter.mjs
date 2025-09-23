import AuthenticationController from '../Authentication/AuthenticationController.js'
import TemplatesController from './TemplatesController.js'
import TemplatesMiddleware from './TemplatesMiddleware.js'
import { RateLimiter } from '../../infrastructure/RateLimiter.js'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.js'
import AnalyticsRegistrationSourceMiddleware from '../Analytics/AnalyticsRegistrationSourceMiddleware.js'

const rateLimiter = new RateLimiter('create-project-from-template', {
  points: 20,
  duration: 60,
})

export default {
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
