import { vi, assert } from 'vitest'
import sinon from 'sinon'
import path from 'node:path'
const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Notifications/NotificationsHandler.mjs'
)

describe('NotificationsHandler', function () {
  const userId = '123nd3ijdks'
  const notificationId = '123njdskj9jlk'
  const notificationUrl = 'notification.overleaf.testing'

  beforeEach(async function (ctx) {
    ctx.request = sinon.stub().callsArgWith(1)

    vi.doMock('@overleaf/settings', () => ({
      default: {
        apis: { notifications: { url: notificationUrl } },
      },
    }))

    vi.doMock('request', () => ({
      default: ctx.request,
    }))

    ctx.handler = (await import(modulePath)).default
  })

  describe('getUserNotifications', function () {
    it('should get unread notifications', async function (ctx) {
      const stubbedNotifications = [{ _id: notificationId, user_id: userId }]
      ctx.request.callsArgWith(
        1,
        null,
        { statusCode: 200 },
        stubbedNotifications
      )
      const unreadNotifications =
        await ctx.handler.promises.getUserNotifications(userId)
      stubbedNotifications.should.deep.equal(unreadNotifications)
      const getOpts = {
        uri: `${notificationUrl}/user/${userId}`,
        json: true,
        timeout: 1000,
        method: 'GET',
      }
      ctx.request.calledWith(getOpts).should.equal(true)
    })

    it('should return empty arrays if there are no notifications', async function (ctx) {
      ctx.request.callsArgWith(1, null, { statusCode: 200 }, null)
      const unreadNotifications =
        await ctx.handler.promises.getUserNotifications(userId)
      unreadNotifications.length.should.equal(0)
    })
  })

  describe('markAsRead', function () {
    beforeEach(function (ctx) {
      ctx.key = 'some key here'
    })

    it('should send a delete request when a delete has been received to mark a notification', async function (ctx) {
      await ctx.handler.promises.markAsReadWithKey(userId, ctx.key)
      const opts = {
        uri: `${notificationUrl}/user/${userId}`,
        json: {
          key: ctx.key,
        },
        timeout: 1000,
        method: 'DELETE',
      }
      ctx.request.calledWith(opts).should.equal(true)
    })
  })

  describe('createNotification', function () {
    beforeEach(function (ctx) {
      ctx.key = 'some key here'
      ctx.messageOpts = { value: 12344 }
      ctx.templateKey = 'renderThisHtml'
      ctx.expiry = null
    })

    it('should post the message over', async function (ctx) {
      await ctx.handler.promises.createNotification(
        userId,
        ctx.key,
        ctx.templateKey,
        ctx.messageOpts,
        ctx.expiry
      )
      const args = ctx.request.args[0][0]
      args.uri.should.equal(`${notificationUrl}/user/${userId}`)
      args.timeout.should.equal(1000)
      const expectedJson = {
        key: ctx.key,
        templateKey: ctx.templateKey,
        messageOpts: ctx.messageOpts,
        forceCreate: true,
      }
      assert.deepEqual(args.json, expectedJson)
    })

    describe('when expiry date is supplied', function () {
      beforeEach(function (ctx) {
        ctx.key = 'some key here'
        ctx.messageOpts = { value: 12344 }
        ctx.templateKey = 'renderThisHtml'
        ctx.expiry = new Date()
      })

      it('should post the message over with expiry field', async function (ctx) {
        await ctx.handler.promises.createNotification(
          userId,
          ctx.key,
          ctx.templateKey,
          ctx.messageOpts,
          ctx.expiry
        )

        const args = ctx.request.args[0][0]
        args.uri.should.equal(`${notificationUrl}/user/${userId}`)
        args.timeout.should.equal(1000)
        const expectedJson = {
          key: ctx.key,
          templateKey: ctx.templateKey,
          messageOpts: ctx.messageOpts,
          expires: ctx.expiry,
          forceCreate: true,
        }
        assert.deepEqual(args.json, expectedJson)
      })
    })
  })

  describe('markAsReadByKeyOnly', function () {
    beforeEach(function (ctx) {
      ctx.key = 'some key here'
    })

    it('should send a delete request when a delete has been received to mark a notification', async function (ctx) {
      await ctx.handler.promises.markAsReadByKeyOnly(ctx.key)
      const opts = {
        uri: `${notificationUrl}/key/${ctx.key}`,
        timeout: 1000,
        method: 'DELETE',
      }
      ctx.request.calledWith(opts).should.equal(true)
    })
  })
})
