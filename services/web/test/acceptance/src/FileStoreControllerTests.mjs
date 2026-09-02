import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

const User = UserHelper.promises

describe('FileStoreController', function () {
  let owner, projectId

  beforeEach(async function () {
    owner = new User()
    await owner.login()
    projectId = await owner.createProject('filestore-controller-test', {
      template: 'blank',
    })
  })

  describe('GET /Project/:Project_id/file/:File_id', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/Project/not-an-object-id/file/${projectId}`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })

    it('should reject a malformed file id with 404', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/Project/${projectId}/file/not-an-object-id`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'File_id'
      )
    })
  })

  describe('HEAD /Project/:Project_id/file/:File_id', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response } = await owner.doRequest('head', {
        url: `/Project/not-an-object-id/file/${projectId}`,
      })
      // HEAD responses carry no body to assert a validation message against
      expect(response.statusCode).to.equal(404)
    })
  })
})
