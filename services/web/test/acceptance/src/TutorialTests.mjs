import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

const User = UserHelper.promises

describe('Tutorial', function () {
  let user
  const tutorialKey = 'workbench-consent'

  beforeEach(async function () {
    user = new User()
    await user.login()
  })

  describe('POST /tutorial/:tutorialKey/complete', function () {
    it('should mark the tutorial as completed', async function () {
      const { response } = await user.doRequest('post', {
        url: `/tutorial/${tutorialKey}/complete`,
        json: true,
      })
      expect(response.statusCode).to.equal(204)
    })

    it('should reject an unrecognized tutorial key with 404', async function () {
      const { response, body } = await user.doRequest('post', {
        url: '/tutorial/not-a-real-tutorial/complete',
        json: true,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'tutorialKey'
      )
    })
  })

  describe('POST /tutorial/:tutorialKey/postpone', function () {
    it('should postpone the tutorial with no body', async function () {
      const { response } = await user.doRequest('post', {
        url: `/tutorial/${tutorialKey}/postpone`,
        json: true,
      })
      expect(response.statusCode).to.equal(204)
    })

    it('should postpone the tutorial with a postponedUntil date', async function () {
      const { response } = await user.doRequest('post', {
        url: `/tutorial/${tutorialKey}/postpone`,
        json: { postponedUntil: '2026-08-01T00:00:00.000Z' },
      })
      expect(response.statusCode).to.equal(204)
    })

    it('should reject a malformed postponedUntil value', async function () {
      const { response, body } = await user.doRequest('post', {
        url: `/tutorial/${tutorialKey}/postpone`,
        json: { postponedUntil: 'not-a-date' },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'postponedUntil'
      )
    })

    it('should reject an unrecognized tutorial key with 404', async function () {
      const { response, body } = await user.doRequest('post', {
        url: '/tutorial/not-a-real-tutorial/postpone',
        json: true,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'tutorialKey'
      )
    })
  })
})
