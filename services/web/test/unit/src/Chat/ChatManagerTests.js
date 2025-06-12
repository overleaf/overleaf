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
        '../User/UserGetter': (this.UserGetter = { promises: {} }),
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
          _id: 'user_id_1',
        },
        user_id_2: {
          _id: 'user_id_2',
        },
      }
      this.UserGetter.promises.getUsers = userIds =>
        Promise.resolve(
          Array.from(userIds)
            .map(id => this.users[id])
            .filter(u => !!u)
        )

      sinon.spy(this.UserGetter.promises, 'getUsers')
      return (this.UserInfoController.formatPersonalInfo = user => ({
        formatted: { id: user._id.toString() },
      }))
    })

    it('should inject a user object into messaged and resolved data', async function () {
      const threads = await this.ChatManager.promises.injectUserInfoIntoThreads(
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
        }
      )

      expect(threads).to.deep.equal({
        thread1: {
          resolved: true,
          resolved_by_user_id: 'user_id_1',
          resolved_by_user: { formatted: { id: 'user_id_1' } },
          messages: [
            {
              user_id: 'user_id_1',
              user: { formatted: { id: 'user_id_1' } },
              content: 'foo',
            },
            {
              user_id: 'user_id_2',
              user: { formatted: { id: 'user_id_2' } },
              content: 'bar',
            },
          ],
        },
        thread2: {
          messages: [
            {
              user_id: 'user_id_1',
              user: { formatted: { id: 'user_id_1' } },
              content: 'baz',
            },
          ],
        },
      })
    })

    it('should lookup all users in a single batch', async function () {
      await this.ChatManager.promises.injectUserInfoIntoThreads([
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
      ])

      this.UserGetter.promises.getUsers.should.have.been.calledOnce
    })
  })
})
