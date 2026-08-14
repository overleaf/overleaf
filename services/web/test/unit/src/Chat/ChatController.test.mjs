import { beforeEach, describe, it, vi } from 'vitest'
import sinon from 'sinon'

const MODULE_PATH = '../../../../app/src/Features/Chat/ChatController.mjs'

describe('ChatController', function () {
  beforeEach(async function (ctx) {
    ctx.user_id = 'mock-user-id'
    // project_id/message_id are validated as Mongo ObjectIds
    ctx.project_id = '507f191e810c19729de860ea'
    ctx.message_id = '507f191e810c19729de860eb'
    ctx.settings = {}
    ctx.ChatApiHandler = { promises: {} }
    ctx.ChatManager = { promises: {} }
    ctx.EditorRealTimeController = { emitToRoom: sinon.stub() }
    ctx.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(ctx.user_id),
    }
    ctx.UserInfoManager = {
      promises: {},
    }
    ctx.UserInfoController = {}
    ctx.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub().resolves(),
        },
      },
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('../../../../app/src/Features/Chat/ChatApiHandler.mjs', () => ({
      default: ctx.ChatApiHandler,
    }))

    vi.doMock('../../../../app/src/Features/Chat/ChatManager.mjs', () => ({
      default: ctx.ChatManager,
    }))

    vi.doMock(
      '../../../../app/src/Features/Editor/EditorRealTimeController.mjs',
      () => ({
        default: ctx.EditorRealTimeController,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager.mjs',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserInfoManager.mjs', () => ({
      default: ctx.UserInfoManager,
    }))

    vi.doMock(
      '../../../../app/src/Features/User/UserInfoController.mjs',
      () => ({
        default: ctx.UserInfoController,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Modules.mjs', () => ({
      default: ctx.Modules,
    }))

    ctx.ChatController = (await import(MODULE_PATH)).default
    ctx.req = {
      params: {
        project_id: ctx.project_id,
      },
    }
    ctx.res = {
      json: sinon.stub(),
      send: sinon.stub(),
      sendStatus: sinon.stub(),
    }
  })

  describe('sendMessage', function () {
    beforeEach(async function (ctx) {
      ctx.req.body = { content: (ctx.content = 'message-content') }
      ctx.UserInfoManager.promises.getPersonalInfo = sinon
        .stub()
        .resolves((ctx.user = { unformatted: 'user' }))
      ctx.UserInfoController.formatPersonalInfo = sinon
        .stub()
        .returns((ctx.formatted_user = { formatted: 'user' }))
      ctx.ChatApiHandler.promises.sendGlobalMessage = sinon
        .stub()
        .resolves((ctx.message = { mock: 'message', user_id: ctx.user_id }))
      await ctx.ChatController.sendMessage(ctx.req, ctx.res)
    })

    it('should look up the user', function (ctx) {
      ctx.UserInfoManager.promises.getPersonalInfo
        .calledWith(ctx.user_id)
        .should.equal(true)
    })

    it('should format and inject the user into the message', function (ctx) {
      ctx.UserInfoController.formatPersonalInfo
        .calledWith(ctx.user)
        .should.equal(true)
      ctx.message.user.should.deep.equal(ctx.formatted_user)
    })

    it('should tell the chat handler about the message', function (ctx) {
      ctx.ChatApiHandler.promises.sendGlobalMessage
        .calledWith(ctx.project_id, ctx.user_id, ctx.content)
        .should.equal(true)
    })

    it('should tell the editor real time controller about the update with the data from the chat handler', function (ctx) {
      ctx.EditorRealTimeController.emitToRoom
        .calledWith(ctx.project_id, 'new-chat-message', ctx.message)
        .should.equal(true)
    })

    it('should return a 204 status code', function (ctx) {
      ctx.res.sendStatus.calledWith(204).should.equal(true)
    })
  })

  describe('getMessages', function () {
    beforeEach(async function (ctx) {
      // sent over the wire as query-string values, but coerced to numbers
      // by the schema before being passed on
      ctx.req.query = { limit: '30', before: '12345' }
      ctx.limit = 30
      ctx.before = 12345
      ctx.ChatManager.promises.injectUserInfoIntoThreads = sinon
        .stub()
        .resolves()
      ctx.ChatApiHandler.promises.getGlobalMessages = sinon
        .stub()
        .resolves((ctx.messages = ['mock', 'messages']))
      await ctx.ChatController.getMessages(ctx.req, ctx.res)
    })

    it('should ask the chat handler about the request', function (ctx) {
      ctx.ChatApiHandler.promises.getGlobalMessages
        .calledWith(ctx.project_id, ctx.limit, ctx.before)
        .should.equal(true)
    })

    it('should return the messages', function (ctx) {
      ctx.res.json.calledWith(ctx.messages).should.equal(true)
    })
  })

  describe('deleteMessage', function () {
    beforeEach(async function (ctx) {
      ctx.req.params.message_id = ctx.message_id
      ctx.ChatApiHandler.promises.deleteGlobalMessage = sinon.stub().resolves()
      await ctx.ChatController.deleteMessage(ctx.req, ctx.res)
    })

    it('should tell the chat handler to delete the message', function (ctx) {
      ctx.ChatApiHandler.promises.deleteGlobalMessage
        .calledWith(ctx.project_id, ctx.message_id)
        .should.equal(true)
    })

    it('should tell the editor real time controller about the deletion', function (ctx) {
      ctx.EditorRealTimeController.emitToRoom
        .calledWith(ctx.project_id, 'delete-global-message', {
          messageId: ctx.message_id,
          userId: ctx.user_id,
        })
        .should.equal(true)
    })

    it('should return a 204 status code', function (ctx) {
      ctx.res.sendStatus.calledWith(204).should.equal(true)
    })
  })

  describe('editMessage', function () {
    beforeEach(async function (ctx) {
      ctx.req.params.message_id = ctx.message_id
      ctx.req.body = { content: (ctx.content = 'edited-content') }
      ctx.ChatApiHandler.promises.editGlobalMessage = sinon.stub().resolves()
      await ctx.ChatController.editMessage(ctx.req, ctx.res, sinon.stub())
    })

    it('should tell the chat handler to edit the message', function (ctx) {
      ctx.ChatApiHandler.promises.editGlobalMessage
        .calledWith(ctx.project_id, ctx.message_id, ctx.user_id, ctx.content)
        .should.equal(true)
    })

    it('should tell the editor real time controller about the edit', function (ctx) {
      ctx.EditorRealTimeController.emitToRoom
        .calledWith(ctx.project_id, 'edit-global-message', {
          messageId: ctx.message_id,
          userId: ctx.user_id,
          content: ctx.content,
        })
        .should.equal(true)
    })

    it('should return a 204 status code', function (ctx) {
      ctx.res.sendStatus.calledWith(204).should.equal(true)
    })
  })
})
