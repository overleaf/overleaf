import AbstractMockApi from './AbstractMockApi.mjs'
import { parseReq, z } from '@overleaf/validation-tools'

// Body sent by CaptchaMiddleware's siteverify request: `secret` (the
// configured recaptcha.secretKey) plus the client-supplied
// `g-recaptcha-response` forwarded as `response`.
const siteVerifySchema = z.object({
  body: z.strictObject({
    secret: z.string(),
    response: z.string(),
  }),
})

class MockReCaptchaApi extends AbstractMockApi {
  applyRoutes() {
    this.app.post('/recaptcha/api/siteverify', (req, res) => {
      const { body } = parseReq(req, siteVerifySchema)
      res.json({
        success: body.response === 'valid',
      })
    })
  }
}

export default MockReCaptchaApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockReCaptchaApi
 * @static
 * @returns {MockReCaptchaApi}
 */
