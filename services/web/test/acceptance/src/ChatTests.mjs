import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

const User = UserHelper.promises

describe('Chat', function () {
  let owner, projectId

  beforeEach(async function () {
    owner = new User()
    await owner.login()
    projectId = await owner.createProject('chat-test', { template: 'blank' })
  })

  describe('GET /project/:project_id/messages', function () {
    it('should return an empty list of messages initially', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/messages`,
        json: true,
      })
      expect(response.statusCode).to.equal(200)
      expect(body).to.deep.equal([])
    })

    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/project/not-an-object-id/messages`,
        json: true,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'project_id'
      )
    })
  })

  describe('POST /project/:project_id/messages', function () {
    it('should send a message and return it in later gets', async function () {
      const sendResult = await owner.doRequest('post', {
        url: `/project/${projectId}/messages`,
        json: { content: 'hello world' },
      })
      expect(sendResult.response.statusCode).to.equal(204)

      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/messages`,
        json: true,
      })
      expect(response.statusCode).to.equal(200)
      expect(body).to.have.length(1)
      expect(body[0].content).to.equal('hello world')
      expect(body[0].user.id).to.equal(owner._id.toString())
    })

    it('should reject a missing content field', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectId}/messages`,
        json: {},
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'content'
      )
    })

    it('should accept numeric limit and before query params', async function () {
      // MockChatApi does not implement limit/before filtering itself; this
      // only exercises that the coerced numeric values are accepted and
      // forwarded rather than rejected by validation.
      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/messages?limit=2&before=99999999999`,
        json: true,
      })
      expect(response.statusCode).to.equal(200)
      expect(body).to.deep.equal([])
    })

    it('should reject a non-numeric limit', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/messages?limit=not-a-number`,
        json: true,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'limit'
      )
    })
  })

  describe('POST /project/:project_id/messages/:message_id/edit', function () {
    let messageId

    beforeEach(async function () {
      await owner.doRequest('post', {
        url: `/project/${projectId}/messages`,
        json: { content: 'original content' },
      })
      const { body } = await owner.doRequest('get', {
        url: `/project/${projectId}/messages`,
        json: true,
      })
      messageId = body[0].id
    })

    it('should edit the message content', async function () {
      const editResult = await owner.doRequest('post', {
        url: `/project/${projectId}/messages/${messageId}/edit`,
        json: { content: 'edited content' },
      })
      expect(editResult.response.statusCode).to.equal(204)

      const { body } = await owner.doRequest('get', {
        url: `/project/${projectId}/messages`,
        json: true,
      })
      expect(body[0].content).to.equal('edited content')
    })

    it('should reject a malformed message id with 404', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectId}/messages/not-an-object-id/edit`,
        json: { content: 'edited content' },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'message_id'
      )
    })
  })

  describe('DELETE /project/:project_id/messages/:message_id', function () {
    let messageId

    beforeEach(async function () {
      await owner.doRequest('post', {
        url: `/project/${projectId}/messages`,
        json: { content: 'to be deleted' },
      })
      const { body } = await owner.doRequest('get', {
        url: `/project/${projectId}/messages`,
        json: true,
      })
      messageId = body[0].id
    })

    it('should delete the message', async function () {
      const deleteResult = await owner.doRequest('delete', {
        url: `/project/${projectId}/messages/${messageId}`,
        json: true,
      })
      expect(deleteResult.response.statusCode).to.equal(204)

      const { body } = await owner.doRequest('get', {
        url: `/project/${projectId}/messages`,
        json: true,
      })
      expect(body).to.deep.equal([])
    })

    it('should reject a malformed message id with 404', async function () {
      const { response, body } = await owner.doRequest('delete', {
        url: `/project/${projectId}/messages/not-an-object-id`,
        json: true,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'message_id'
      )
    })
  })
})
