import AbstractMockApi from './AbstractMockApi.mjs'

class MockReCaptchaApi extends AbstractMockApi {
  applyRoutes() {
    this.app.post('/recaptcha/api/siteverify', (req, res) => {
      res.json({
        success: req.body.response === 'valid',
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
