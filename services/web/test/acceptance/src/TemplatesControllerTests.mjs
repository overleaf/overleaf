import UserHelper from './helpers/User.mjs'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

const User = UserHelper.promises

describe('TemplatesController', function () {
  let owner

  beforeEach(async function () {
    owner = new User()
    await owner.login()
  })

  describe('GET /project/new/template/:Template_version_id', function () {
    it('should reject a non-numeric Template_version_id with 404', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: '/project/new/template/not-a-number?id=123',
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Template_version_id'
      )
    })

    it('should reject a non-numeric id query param with 400', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: '/project/new/template/456?id=not-a-number',
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'id'
      )
    })

    it('should reject a non-string templateName query param with 400', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: '/project/new/template/456?id=123&templateName=a&templateName=b',
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'templateName'
      )
    })

    it('should reject a path-traversal-shaped brandVariationId query param with 400', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: '/project/new/template/456?id=123&brandVariationId=1%2F..%2F..%2Fv1%2Fx',
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'brandVariationId'
      )
    })
  })

  describe('POST /project/new/template', function () {
    it('should reject a non-numeric templateId with 400', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: '/project/new/template',
        json: {
          templateId: 'not-a-number',
          templateVersionId: '456',
        },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'templateId'
      )
    })

    it('should reject a path-traversal-shaped brandVariationId with 400', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: '/project/new/template',
        json: {
          templateId: '123',
          templateVersionId: '456',
          brandVariationId: '1/../../v1/x',
        },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'brandVariationId'
      )
    })
  })
})
