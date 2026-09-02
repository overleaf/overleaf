import UserHelper from './helpers/User.mjs'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

const User = UserHelper.promises

describe('Router', function () {
  let user

  beforeEach(async function () {
    user = new User()
    await user.login()
  })

  describe('GET /status/compiler/:Project_id', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await user.doRequest('get', {
        url: '/status/compiler/not-an-object-id',
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })
  })

  describe('POST /error/client', function () {
    it('should log an arbitrary client-reported error and return 204', async function () {
      const { response } = await user.doRequest('post', {
        url: '/error/client',
        json: {
          error: { message: 'boom', stack: 'Error: boom\n    at x' },
          meta: { anything: 'goes', nested: { too: true } },
        },
      })
      response.statusCode.should.equal(204)
    })

    it('should not crash when error/meta are missing', async function () {
      const { response } = await user.doRequest('post', {
        url: '/error/client',
        json: {},
      })
      response.statusCode.should.equal(204)
    })
  })
})
