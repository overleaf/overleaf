/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Chat/ChatController'
)
const { expect } = require('chai')

describe('ChatController', function() {
  beforeEach(function() {
    this.user_id = 'mock-user-id'
    this.settings = {}
    this.ChatApiHandler = {}
    this.EditorRealTimeController = { emitToRoom: sinon.stub() }
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.user_id)
    }
    this.ChatController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': this.settings,
        'logger-sharelatex': {
          log() {}
        },
        './ChatApiHandler': this.ChatApiHandler,
        '../Editor/EditorRealTimeController': this.EditorRealTimeController,
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
        '../User/UserInfoManager': (this.UserInfoManager = {}),
        '../User/UserInfoController': (this.UserInfoController = {}),
        '../Comments/CommentsController': (this.CommentsController = {})
      }
    })
    this.req = {
      params: {
        project_id: this.project_id
      }
    }
    return (this.res = {
      json: sinon.stub(),
      send: sinon.stub()
    })
  })

  describe('sendMessage', function() {
    beforeEach(function() {
      this.req.body = { content: (this.content = 'message-content') }
      this.UserInfoManager.getPersonalInfo = sinon
        .stub()
        .yields(null, (this.user = { unformatted: 'user' }))
      this.UserInfoController.formatPersonalInfo = sinon
        .stub()
        .returns((this.formatted_user = { formatted: 'user' }))
      this.ChatApiHandler.sendGlobalMessage = sinon
        .stub()
        .yields(
          null,
          (this.message = { mock: 'message', user_id: this.user_id })
        )
      return this.ChatController.sendMessage(this.req, this.res)
    })

    it('should look up the user', function() {
      return this.UserInfoManager.getPersonalInfo
        .calledWith(this.user_id)
        .should.equal(true)
    })

    it('should format and inject the user into the message', function() {
      this.UserInfoController.formatPersonalInfo
        .calledWith(this.user)
        .should.equal(true)
      return this.message.user.should.deep.equal(this.formatted_user)
    })

    it('should tell the chat handler about the message', function() {
      return this.ChatApiHandler.sendGlobalMessage
        .calledWith(this.project_id, this.user_id, this.content)
        .should.equal(true)
    })

    it('should tell the editor real time controller about the update with the data from the chat handler', function() {
      return this.EditorRealTimeController.emitToRoom
        .calledWith(this.project_id, 'new-chat-message', this.message)
        .should.equal(true)
    })

    it('should return a 204 status code', function() {
      return this.res.send.calledWith(204).should.equal(true)
    })
  })

  describe('getMessages', function() {
    beforeEach(function() {
      this.req.query = {
        limit: (this.limit = '30'),
        before: (this.before = '12345')
      }
      this.ChatController._injectUserInfoIntoThreads = sinon.stub().yields()
      this.ChatApiHandler.getGlobalMessages = sinon
        .stub()
        .yields(null, (this.messages = ['mock', 'messages']))
      return this.ChatController.getMessages(this.req, this.res)
    })

    it('should ask the chat handler about the request', function() {
      return this.ChatApiHandler.getGlobalMessages
        .calledWith(this.project_id, this.limit, this.before)
        .should.equal(true)
    })

    it('should return the messages', function() {
      return this.res.json.calledWith(this.messages).should.equal(true)
    })
  })

  describe('_injectUserInfoIntoThreads', function() {
    beforeEach(function() {
      this.users = {
        user_id_1: {
          mock: 'user_1'
        },
        user_id_2: {
          mock: 'user_2'
        }
      }
      this.UserInfoManager.getPersonalInfo = (user_id, callback) => {
        return callback(null, this.users[user_id])
      }
      sinon.spy(this.UserInfoManager, 'getPersonalInfo')
      return (this.UserInfoController.formatPersonalInfo = user => ({
        formatted: user['mock']
      }))
    })

    it('should inject a user object into messaged and resolved data', function(done) {
      return this.ChatController._injectUserInfoIntoThreads(
        {
          thread1: {
            resolved: true,
            resolved_by_user_id: 'user_id_1',
            messages: [
              {
                user_id: 'user_id_1',
                content: 'foo'
              },
              {
                user_id: 'user_id_2',
                content: 'bar'
              }
            ]
          },
          thread2: {
            messages: [
              {
                user_id: 'user_id_1',
                content: 'baz'
              }
            ]
          }
        },
        (error, threads) => {
          expect(threads).to.deep.equal({
            thread1: {
              resolved: true,
              resolved_by_user_id: 'user_id_1',
              resolved_by_user: { formatted: 'user_1' },
              messages: [
                {
                  user_id: 'user_id_1',
                  user: { formatted: 'user_1' },
                  content: 'foo'
                },
                {
                  user_id: 'user_id_2',
                  user: { formatted: 'user_2' },
                  content: 'bar'
                }
              ]
            },
            thread2: {
              messages: [
                {
                  user_id: 'user_id_1',
                  user: { formatted: 'user_1' },
                  content: 'baz'
                }
              ]
            }
          })
          return done()
        }
      )
    })

    it('should only need to look up each user once', function(done) {
      return this.ChatController._injectUserInfoIntoThreads(
        [
          {
            messages: [
              {
                user_id: 'user_id_1',
                content: 'foo'
              },
              {
                user_id: 'user_id_1',
                content: 'bar'
              }
            ]
          }
        ],
        (error, threads) => {
          this.UserInfoManager.getPersonalInfo.calledOnce.should.equal(true)
          return done()
        }
      )
    })
  })
})
