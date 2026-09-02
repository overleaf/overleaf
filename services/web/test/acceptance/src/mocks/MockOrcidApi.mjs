import AbstractMockApi from './AbstractMockApi.mjs'
import { parseReq, z } from '@overleaf/validation-tools'

// Token exchange body as built by passport-oauth2/the `oauth` library's
// OAuth2#getOAuthAccessToken (standard authorization_code grant).
const tokenSchema = z.object({
  body: z.strictObject({
    code: z.string(),
    client_id: z.string(),
    client_secret: z.string(),
    grant_type: z.literal('authorization_code'),
    redirect_uri: z.string(),
  }),
})

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
      const { body } = parseReq(req, tokenSchema)
      const token = this.tokens[body.code]
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
