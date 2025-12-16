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
  const notificationUrl = 'http://notification.overleaf.testing'

  beforeEach(async function (ctx) {
    ctx.FetchUtils = {
      fetchJson: sinon.stub().resolves(),
      fetchNothing: sinon.stub().resolves(),
    }

    vi.doMock('@overleaf/settings', () => ({
      default: {
        apis: { notifications: { url: notificationUrl } },
      },
    }))

    vi.doMock('@overleaf/fetch-utils', () => ctx.FetchUtils)

    ctx.handler = (await import(modulePath)).default
  })

  describe('getUserNotifications', function () {
    it('should get unread notifications', async function (ctx) {
      const stubbedNotifications = [{ _id: notificationId, user_id: userId }]
      ctx.FetchUtils.fetchJson.resolves(stubbedNotifications)
      const unreadNotifications =
        await ctx.handler.promises.getUserNotifications(userId)
      stubbedNotifications.should.deep.equal(unreadNotifications)
      ctx.FetchUtils.fetchJson
        .calledWith(
          sinon.match(u => u.href === `${notificationUrl}/user/${userId}`)
        )
        .should.equal(true)
    })

    it('should return empty arrays if there are no notifications', async function (ctx) {
      ctx.FetchUtils.fetchJson.resolves(null)
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
      ctx.FetchUtils.fetchNothing
        .calledWith(
          sinon.match(u => u.href === `${notificationUrl}/user/${userId}`),
          sinon.match({
            method: 'DELETE',
            json: { key: ctx.key },
          })
        )
        .should.equal(true)
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
      const [url, opts] = ctx.FetchUtils.fetchNothing.getCall(0).args
      url.href.should.equal(`${notificationUrl}/user/${userId}`)
      opts.method.should.equal('POST')

      const expectedJson = {
        key: ctx.key,
        templateKey: ctx.templateKey,
        messageOpts: ctx.messageOpts,
        forceCreate: true,
      }
      assert.deepEqual(opts.json, expectedJson)
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

        const [url, args] = ctx.FetchUtils.fetchNothing.getCall(0).args
        url.href.should.equal(`${notificationUrl}/user/${userId}`)
        args.method.should.equal('POST')

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
      ctx.FetchUtils.fetchNothing
        .calledWith(
          sinon.match(
            u => u.href === `${notificationUrl}/key/some%20key%20here`
          ),
          sinon.match({
            method: 'DELETE',
          })
        )
        .should.equal(true)
    })
  })
})
