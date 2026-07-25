import AbstractMockApi from './AbstractMockApi.mjs'

class MockOrcidApi extends AbstractMockApi {
  reset() {
    this.profiles = {}
    this.tokens = {}
  }

  // profile: { orcid, name }
  addProfile(profile, token, authorizationCode) {
    this.profiles[token] = { ...profile }
    this.tokens[authorizationCode] = token
  }

  applyRoutes() {
    this.app.post('/oauth/token', (req, res) => {
      const token = this.tokens[req.body.code]
      if (!token) {
        return res.sendStatus(400)
      }
      const profile = this.profiles[token]
      res.json({
        access_token: token,
        token_type: 'bearer',
        scope: '/authenticate',
        ...profile,
      })
    })
  }
}

export default MockOrcidApi

/**
 * @function instance
 * @memberOf MockOrcidApi
 * @static
 * @returns {MockOrcidApi}
 */
