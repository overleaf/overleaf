const AbstractMockApi = require('./AbstractMockApi')

class MockReCaptchaApi extends AbstractMockApi {
  applyRoutes() {
    this.app.post('/recaptcha/api/siteverify', (req, res) => {
      res.json({
        success: req.body.response === 'valid',
      })
    })
  }
}

module.exports = MockReCaptchaApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockReCaptchaApi
 * @static
 * @returns {MockReCaptchaApi}
 */
