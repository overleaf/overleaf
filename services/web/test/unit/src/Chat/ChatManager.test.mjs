import { vi, expect } from 'vitest'
import sinon from 'sinon'

const modulePath = '../../../../app/src/Features/Chat/ChatManager.mjs'

describe('ChatManager', function () {
  beforeEach(async function (ctx) {
    ctx.user_id = 'mock-user-id'

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: (ctx.UserGetter = { promises: {} }),
    }))

    vi.doMock('../../../../app/src/Features/User/UserInfoController', () => ({
      default: (ctx.UserInfoController = {}),
    }))

    ctx.ChatManager = (await import(modulePath)).default
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

  describe('injectUserInfoIntoThreads', function () {
    beforeEach(function (ctx) {
      ctx.users = {
        user_id_1: {
          _id: 'user_id_1',
        },
        user_id_2: {
          _id: 'user_id_2',
        },
      }
      ctx.UserGetter.promises.getUsers = userIds =>
        Promise.resolve(
          Array.from(userIds)
            .map(id => ctx.users[id])
            .filter(u => !!u)
        )

      sinon.spy(ctx.UserGetter.promises, 'getUsers')
      ctx.UserInfoController.formatPersonalInfo = user => ({
        formatted: { id: user._id.toString() },
      })
    })

    it('should inject a user object into messaged and resolved data', async function (ctx) {
      const threads = await ctx.ChatManager.promises.injectUserInfoIntoThreads({
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
      })

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

    it('should lookup all users in a single batch', async function (ctx) {
      await ctx.ChatManager.promises.injectUserInfoIntoThreads([
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

      ctx.UserGetter.promises.getUsers.should.have.been.calledOnce
    })
  })
})
