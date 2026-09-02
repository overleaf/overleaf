import UserHelper from './helpers/User.mjs'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

const User = UserHelper.promises

describe('DocumentUpdaterController', function () {
  let owner, projectId

  beforeEach(async function () {
    owner = new User()
    await owner.login()
    projectId = await owner.createProject('document-updater-controller-test', {
      template: 'blank',
    })
  })

  describe('GET /Project/:Project_id/doc/:Doc_id/download', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/Project/not-an-object-id/doc/${projectId}/download`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })

    it('should reject a malformed doc id with 404', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/Project/${projectId}/doc/not-an-object-id/download`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Doc_id'
      )
    })
  })
})
