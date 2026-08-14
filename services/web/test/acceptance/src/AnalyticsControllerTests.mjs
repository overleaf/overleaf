import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import request from './helpers/request.js'
import Features from '../../../app/src/infrastructure/Features.mjs'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

const User = UserHelper.promises
const authedRequest = request.promises

const auth = Buffer.from('overleaf:password').toString('base64')
function privateApiRequest(options) {
  return authedRequest.request({
    ...options,
    json: options.json === undefined ? true : options.json,
    headers: {
      ...options.headers,
      Authorization: `Basic ${auth}`,
    },
  })
}

describe('AnalyticsController', function () {
  let owner

  beforeEach(async function () {
    owner = new User()
    await owner.login()
  })

  describe('POST /event/:event', function () {
    it('should accept a well-formed event', async function () {
      const { response } = await owner.doRequest('post', {
        url: '/event/i-did-something',
        json: { editorType: 'abc' },
      })
      expect(response.statusCode).to.equal(202)
    })

    it('should reject a segmentation key with disallowed characters', async function () {
      if (!Features.hasFeature('analytics')) {
        this.skip()
      }
      const { response, body } = await owner.doRequest('post', {
        url: '/event/i-did-something',
        json: { 'bad key!': 'x' },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'bad key!'
      )
    })

    it('should reject an event name with disallowed characters', async function () {
      // AnalyticsRouter's `:event([a-z0-9-_]+)` route pattern rejects this
      // before the request ever reaches the controller/schema, so this holds
      // regardless of the analytics feature flag.
      const { response } = await owner.doRequest('post', {
        url: '/event/Bad!Event',
        json: { editorType: 'abc' },
      })
      expect(response.statusCode).to.equal(404)
    })

    it('should not match the route for an event name containing a dot', async function () {
      const { response } = await owner.doRequest('post', {
        url: '/event/foo.bar',
        json: { editorType: 'abc' },
      })
      expect(response.statusCode).to.equal(404)
    })
  })

  describe('PUT /editingSession/:projectId', function () {
    it('should reject a malformed project id with 404', async function () {
      if (!Features.hasFeature('analytics')) {
        this.skip()
      }
      const { response, body } = await owner.doRequest('put', {
        url: '/editingSession/not-an-object-id',
        json: { segmentation: { editorType: 'abc' } },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'projectId'
      )
    })
  })

  describe('POST /analytics/register-v-1-salesforce-mapping', function () {
    it('should accept a well-formed mapping', async function () {
      if (!Features.hasFeature('analytics')) {
        this.skip()
      }
      const response = await privateApiRequest({
        method: 'post',
        url: '/analytics/register-v-1-salesforce-mapping',
        json: {
          createdAt: new Date().toISOString(),
          salesforceId: '000000000000A0aaaA',
          v1Id: 42,
        },
      })
      expect(response.statusCode).to.equal(202)
    })

    it('should reject a non-numeric v1Id', async function () {
      if (!Features.hasFeature('analytics')) {
        this.skip()
      }
      const response = await privateApiRequest({
        method: 'post',
        url: '/analytics/register-v-1-salesforce-mapping',
        json: {
          createdAt: new Date().toISOString(),
          salesforceId: '000000000000A0aaaA',
          v1Id: 'not-a-number',
        },
      })
      expectValidationErrorRaw(response, 400, 'v1Id')
    })
  })
})
