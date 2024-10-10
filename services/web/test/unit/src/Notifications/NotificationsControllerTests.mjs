import esmock from 'esmock'
import sinon from 'sinon'

const modulePath = new URL(
  '../../../../app/src/Features/Notifications/NotificationsController.mjs',
  import.meta.url
).pathname

describe('NotificationsController', function () {
  const userId = '123nd3ijdks'
  const notificationId = '123njdskj9jlk'

  beforeEach(async function () {
    this.handler = {
      getUserNotifications: sinon.stub().callsArgWith(1),
      markAsRead: sinon.stub().callsArgWith(2),
    }
    this.req = {
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
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.req.session.user._id),
    }
    this.controller = await esmock.strict(modulePath, {
      '../../../../app/src/Features/Notifications/NotificationsHandler':
        this.handler,
      '../../../../app/src/Features/Authentication/AuthenticationController':
        this.AuthenticationController,
    })
  })

  it('should ask the handler for all unread notifications', function (done) {
    const allNotifications = [{ _id: notificationId, user_id: userId }]
    this.handler.getUserNotifications = sinon
      .stub()
      .callsArgWith(1, null, allNotifications)
    this.controller.getAllUnreadNotifications(this.req, {
      json: body => {
        body.should.deep.equal(allNotifications)
        this.handler.getUserNotifications.calledWith(userId).should.equal(true)
        done()
      },
    })
  })

  it('should send a delete request when a delete has been received to mark a notification', function (done) {
    this.controller.markNotificationAsRead(this.req, {
      sendStatus: () => {
        this.handler.markAsRead
          .calledWith(userId, notificationId)
          .should.equal(true)
        done()
      },
    })
  })
})
