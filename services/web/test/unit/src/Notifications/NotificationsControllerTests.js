const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Notifications/NotificationsController.js'
)

describe('NotificationsController', function () {
  const userId = '123nd3ijdks'
  const notificationId = '123njdskj9jlk'

  beforeEach(function () {
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
    this.controller = SandboxedModule.require(modulePath, {
      requires: {
        './NotificationsHandler': this.handler,
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
      },
    })
  })

  it('should ask the handler for all unread notifications', function (done) {
    const allNotifications = [{ _id: notificationId, user_id: userId }]
    this.handler.getUserNotifications = sinon
      .stub()
      .callsArgWith(1, null, allNotifications)
    this.controller.getAllUnreadNotifications(this.req, {
      send: body => {
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
