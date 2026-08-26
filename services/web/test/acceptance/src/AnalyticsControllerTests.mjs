import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import request from './helpers/request.js'
import Features from '../../../app/src/infrastructure/Features.mjs'
import MockAnalyticsApiClass from './mocks/MockAnalyticsApi.mjs'
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

let MockAnalyticsApi

before(function () {
  if (Features.hasFeature('saas')) {
    MockAnalyticsApi = MockAnalyticsApiClass.instance()
  }
})

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

  describe('GET /analytics/uniExternalCollaboration', function () {
    beforeEach(function () {
      // both the analytics API URL and its mock are saas-only, see
      // test/acceptance/config/settings.test.saas.js and Init.mjs
      if (!Features.hasFeature('saas')) {
        this.skip()
      }
      MockAnalyticsApi.reset()
    })

    it('should return the data from the analytics service', async function () {
      const response = await privateApiRequest({
        method: 'get',
        url: '/analytics/uniExternalCollaboration?university_id=42',
      })
      expect(response.statusCode).to.equal(200)
      expect(response.body).to.deep.equal([
        { university_id: 123, external_collaborations: 321 },
      ])
      expect(
        MockAnalyticsApi.getLastUniExternalCollaborationRequest().query
      ).to.deep.equal({ university_id: '42' })
    })

    it('should reject a non-numeric university id', async function () {
      const response = await privateApiRequest({
        method: 'get',
        url: '/analytics/uniExternalCollaboration?university_id=not-a-number',
      })
      expectValidationErrorRaw(response, 400, 'university_id')
    })

    it('should reject a non-positive university id', async function () {
      const response = await privateApiRequest({
        method: 'get',
        url: '/analytics/uniExternalCollaboration?university_id=0',
      })
      expectValidationErrorRaw(response, 400, 'university_id')
    })

    it('should reject a missing university id', async function () {
      const response = await privateApiRequest({
        method: 'get',
        url: '/analytics/uniExternalCollaboration',
      })
      expectValidationErrorRaw(response, 400, 'university_id')
    })

    it('should require private API auth', async function () {
      const response = await authedRequest.request({
        method: 'get',
        url: '/analytics/uniExternalCollaboration?university_id=42',
        json: true,
      })
      expect(response.statusCode).to.equal(401)
    })

    it('should not route a sub-path to the analytics service', async function () {
      const response = await privateApiRequest({
        method: 'get',
        url: '/analytics/uniExternalCollaboration/extra?university_id=42',
      })
      expect(response.statusCode).to.equal(404)
    })

    it('should not route other methods to the analytics service', async function () {
      await privateApiRequest({
        method: 'post',
        url: '/analytics/uniExternalCollaboration?university_id=42',
      })
      expect(MockAnalyticsApi.getLastUniExternalCollaborationRequest()).to.be
        .null
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
