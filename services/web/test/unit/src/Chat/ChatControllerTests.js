const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/Chat/ChatController'
)

describe('ChatController', function () {
  beforeEach(function () {
    this.user_id = 'mock-user-id'
    this.settings = {}
    this.ChatApiHandler = { promises: {} }
    this.ChatManager = { promises: {} }
    this.EditorRealTimeController = { emitToRoom: sinon.stub() }
    this.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(this.user_id),
    }
    this.UserInfoManager = {
      promises: {},
    }
    this.UserInfoController = {}
    this.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub().resolves(),
        },
      },
    }
    this.ChatController = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/settings': this.settings,
        './ChatApiHandler': this.ChatApiHandler,
        './ChatManager': this.ChatManager,
        '../Editor/EditorRealTimeController': this.EditorRealTimeController,
        '../Authentication/SessionManager': this.SessionManager,
        '../User/UserInfoManager': this.UserInfoManager,
        '../User/UserInfoController': this.UserInfoController,
        '../../infrastructure/Modules': this.Modules,
      },
    })
    this.req = {
      params: {
        project_id: this.project_id,
      },
    }
    this.res = {
      json: sinon.stub(),
      send: sinon.stub(),
      sendStatus: sinon.stub(),
    }
  })

  describe('sendMessage', function () {
    beforeEach(async function () {
      this.req.body = { content: (this.content = 'message-content') }
      this.UserInfoManager.promises.getPersonalInfo = sinon
        .stub()
        .resolves((this.user = { unformatted: 'user' }))
      this.UserInfoController.formatPersonalInfo = sinon
        .stub()
        .returns((this.formatted_user = { formatted: 'user' }))
      this.ChatApiHandler.promises.sendGlobalMessage = sinon
        .stub()
        .resolves((this.message = { mock: 'message', user_id: this.user_id }))
      await this.ChatController.sendMessage(this.req, this.res)
    })

    it('should look up the user', function () {
      this.UserInfoManager.promises.getPersonalInfo
        .calledWith(this.user_id)
        .should.equal(true)
    })

    it('should format and inject the user into the message', function () {
      this.UserInfoController.formatPersonalInfo
        .calledWith(this.user)
        .should.equal(true)
      this.message.user.should.deep.equal(this.formatted_user)
    })

    it('should tell the chat handler about the message', function () {
      this.ChatApiHandler.promises.sendGlobalMessage
        .calledWith(this.project_id, this.user_id, this.content)
        .should.equal(true)
    })

    it('should tell the editor real time controller about the update with the data from the chat handler', function () {
      this.EditorRealTimeController.emitToRoom
        .calledWith(this.project_id, 'new-chat-message', this.message)
        .should.equal(true)
    })

    it('should return a 204 status code', function () {
      this.res.sendStatus.calledWith(204).should.equal(true)
    })
  })

  describe('getMessages', function () {
    beforeEach(async function () {
      this.req.query = {
        limit: (this.limit = '30'),
        before: (this.before = '12345'),
      }
      this.ChatManager.promises.injectUserInfoIntoThreads = sinon
        .stub()
        .resolves()
      this.ChatApiHandler.promises.getGlobalMessages = sinon
        .stub()
        .resolves((this.messages = ['mock', 'messages']))
      await this.ChatController.getMessages(this.req, this.res)
    })

    it('should ask the chat handler about the request', function () {
      this.ChatApiHandler.promises.getGlobalMessages
        .calledWith(this.project_id, this.limit, this.before)
        .should.equal(true)
    })

    it('should return the messages', function () {
      this.res.json.calledWith(this.messages).should.equal(true)
    })
  })
})
