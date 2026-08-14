import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import TemplatesController from './TemplatesController.mjs'
import TemplatesMiddleware from './TemplatesMiddleware.mjs'
import { RateLimiter } from '../../infrastructure/RateLimiter.mjs'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.mjs'
import AnalyticsRegistrationSourceMiddleware from '../Analytics/AnalyticsRegistrationSourceMiddleware.mjs'
import { z, parseReq } from '../../infrastructure/Validation.mjs'

const rateLimiter = new RateLimiter('create-project-from-template', {
  points: 20,
  duration: 60,
})

// Non-strict, and deliberately looser than TemplatesController.getV1Template's
// own numeric-id schema: this only threads the param through to
// AnalyticsRegistrationSourceMiddleware's session bookkeeping, and rejecting
// or reformatting it here isn't this middleware's job -- getV1Template
// (later in the same chain) still enforces the real numeric v1
// template-version-id format for the route.
const templateVersionIdSchema = z.object({
  params: z.object({
    Template_version_id: z.string(),
  }),
})

export default {
  rateLimiter,
  apply(app) {
    app.get(
      '/project/new/template/:Template_version_id',
      (req, res, next) => {
        const { params } = parseReq(req, templateVersionIdSchema, {
          logOnly: true,
        })
        return AnalyticsRegistrationSourceMiddleware.setSource(
          'template',
          params.Template_version_id
        )(req, res, next)
      },
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
