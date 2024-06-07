const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Chat/ChatManager'
)
const { expect } = require('chai')

describe('ChatManager', function () {
  beforeEach(function () {
    this.user_id = 'mock-user-id'
    this.ChatManager = SandboxedModule.require(modulePath, {
      requires: {
        '../User/UserInfoManager': (this.UserInfoManager = {}),
        '../User/UserInfoController': (this.UserInfoController = {}),
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

  describe('injectUserInfoIntoThreads', function () {
    beforeEach(function () {
      this.users = {
        user_id_1: {
          mock: 'user_1',
        },
        user_id_2: {
          mock: 'user_2',
        },
      }
      this.UserInfoManager.getPersonalInfo = (userId, callback) => {
        return callback(null, this.users[userId])
      }
      sinon.spy(this.UserInfoManager, 'getPersonalInfo')
      return (this.UserInfoController.formatPersonalInfo = user => ({
        formatted: user.mock,
      }))
    })

    it('should inject a user object into messaged and resolved data', function (done) {
      return this.ChatManager.injectUserInfoIntoThreads(
        {
          thread1: {
            resolved: true,
            resolved_by_user_id: 'user_id_1',
            messages: [
              {
                user_id: 'user_id_1',
                content: 'foo',
              },
              {
                user_id: 'user_id_2',
                content: 'bar',
              },
            ],
          },
          thread2: {
            messages: [
              {
                user_id: 'user_id_1',
                content: 'baz',
              },
            ],
          },
        },
        (error, threads) => {
          expect(error).to.be.null
          expect(threads).to.deep.equal({
            thread1: {
              resolved: true,
              resolved_by_user_id: 'user_id_1',
              resolved_by_user: { formatted: 'user_1' },
              messages: [
                {
                  user_id: 'user_id_1',
                  user: { formatted: 'user_1' },
                  content: 'foo',
                },
                {
                  user_id: 'user_id_2',
                  user: { formatted: 'user_2' },
                  content: 'bar',
                },
              ],
            },
            thread2: {
              messages: [
                {
                  user_id: 'user_id_1',
                  user: { formatted: 'user_1' },
                  content: 'baz',
                },
              ],
            },
          })
          return done()
        }
      )
    })

    it('should only need to look up each user once', function (done) {
      return this.ChatManager.injectUserInfoIntoThreads(
        [
          {
            messages: [
              {
                user_id: 'user_id_1',
                content: 'foo',
              },
              {
                user_id: 'user_id_1',
                content: 'bar',
              },
            ],
          },
        ],
        (error, threads) => {
          expect(error).to.be.null
          this.UserInfoManager.getPersonalInfo.calledOnce.should.equal(true)
          return done()
        }
      )
    })
  })
})
