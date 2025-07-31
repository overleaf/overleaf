import { vi } from 'vitest'
import sinon from 'sinon'

const modulePath = new URL(
  '../../../../app/src/Features/Notifications/NotificationsController.mjs',
  import.meta.url
).pathname

describe('NotificationsController', function () {
  const userId = '123nd3ijdks'
  const notificationId = '123njdskj9jlk'

  beforeEach(async function (ctx) {
    ctx.handler = {
      getUserNotifications: sinon.stub().callsArgWith(1),
      markAsRead: sinon.stub().callsArgWith(2),
      promises: {
        getUserNotifications: sinon.stub().callsArgWith(1),
      },
    }
    ctx.req = {
      params: {
        notificationId,
      },
      session: {
        user: {
          _id: userId,
        },
      },
      i18n: {
        translate() {},
      },
    }
    ctx.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(ctx.req.session.user._id),
    }

    vi.doMock(
      '../../../../app/src/Features/Notifications/NotificationsHandler',
      () => ({
        default: ctx.handler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationController',
      () => ({
        default: ctx.AuthenticationController,
      })
    )

    ctx.controller = (await import(modulePath)).default
  })

  it('should ask the handler for all unread notifications', async function (ctx) {
    await new Promise(resolve => {
      const allNotifications = [{ _id: notificationId, user_id: userId }]
      ctx.handler.getUserNotifications = sinon
        .stub()
        .callsArgWith(1, null, allNotifications)
      ctx.controller.getAllUnreadNotifications(ctx.req, {
        json: body => {
          body.should.deep.equal(allNotifications)
          ctx.handler.getUserNotifications.calledWith(userId).should.equal(true)
          resolve()
        },
      })
    })
  })

  it('should send a delete request when a delete has been received to mark a notification', async function (ctx) {
    await new Promise(resolve => {
      ctx.controller.markNotificationAsRead(ctx.req, {
        sendStatus: () => {
          ctx.handler.markAsRead
            .calledWith(userId, notificationId)
            .should.equal(true)
          resolve()
        },
      })
    })
  })

  it('should get a notification by notification id', async function (ctx) {
    await new Promise(resolve => {
      const notification = { _id: notificationId, user_id: userId }
      ctx.handler.getUserNotifications = sinon
        .stub()
        .callsArgWith(1, null, [notification])
      ctx.controller.getNotification(ctx.req, {
        json: body => {
          body.should.deep.equal(notification)
          resolve()
        },
        status: () => ({
          end: () => {},
        }),
      })
    })
  })
})
