import { vi } from 'vitest'
import sinon from 'sinon'

const MODULE_PATH = '../../../../app/src/Features/Chat/ChatController.mjs'

describe('ChatController', function () {
  beforeEach(async function (ctx) {
    ctx.user_id = 'mock-user-id'
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
      ctx.req.query = {
        limit: (ctx.limit = '30'),
        before: (ctx.before = '12345'),
      }
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
})
