import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

const User = UserHelper.promises

describe('References', function () {
  let owner, projectId

  beforeEach(async function () {
    owner = new User()
    await owner.login()
    projectId = await owner.createProject('references-test', {
      template: 'blank',
    })
  })

  describe('POST /project/:Project_id/references/indexAll', function () {
    it('should return the projectId and empty keys', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectId}/references/indexAll`,
        json: { shouldBroadcast: false },
      })
      expect(response.statusCode).to.equal(200)
      expect(body).to.deep.equal({ projectId, keys: [] })
    })

    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/not-an-object-id/references/indexAll`,
        json: { shouldBroadcast: false },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })
  })
})
