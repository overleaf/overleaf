import AbstractMockApi from './AbstractMockApi.mjs'

class MockGoogleOauthApi extends AbstractMockApi {
  reset() {
    this.profiles = {}
    this.tokens = {}
  }

  addProfile(profile, token, authorizationCode) {
    this.profiles[token] = {
      picture: 'https://example.com/picture.jpg',
      email_verified: true,
      locale: 'en-GB',
      ...profile,
    }
    this.tokens[authorizationCode] = token
  }

  applyRoutes() {
    this.app.post('/oauth/token', (req, res, next) => {
      if (!this.tokens[req.body.code]) {
        return res.sendStatus(400)
      }
      res.json({
        access_token: this.tokens[req.body.code],
      })
    })

    this.app.get('/oauth2/v3/userinfo', (req, res, next) => {
      if (!this.profiles[req.query.access_token]) {
        return res.sendStatus(400)
      }
      res.json(this.profiles[req.query.access_token])
    })
  }
}

export default MockGoogleOauthApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockGoogleOauthApi
 * @static
 * @returns {MockGoogleOauthApi}
 */
