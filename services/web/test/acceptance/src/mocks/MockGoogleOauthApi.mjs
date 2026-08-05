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

const userinfoSchema = z.object({
  query: z.object({
    access_token: z.string(),
  }),
})

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
      const { body } = parseReq(req, tokenSchema)
      if (!this.tokens[body.code]) {
        return res.sendStatus(400)
      }
      res.json({
        access_token: this.tokens[body.code],
      })
    })

    this.app.get('/oauth2/v3/userinfo', (req, res, next) => {
      const { query } = parseReq(req, userinfoSchema)
      if (!this.profiles[query.access_token]) {
        return res.sendStatus(400)
      }
      res.json(this.profiles[query.access_token])
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
