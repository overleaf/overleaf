/* eslint-disable
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
const sinon = require('sinon')
const modulePath = '../../../app/js/NotificationsController.js'
const SandboxedModule = require('sandboxed-module')
const assert = require('node:assert')

const userId = '51dc93e6fb625a261300003b'
const notificationId = 'fb625a26f09d'
const notificationKey = 'my-notification-key'

describe('Notifications Controller', function () {
  beforeEach(function () {
    const self = this
    this.notifications = {}
    this.controller = SandboxedModule.require(modulePath, {
      requires: {
        './Notifications': this.notifications,
        '@overleaf/metrics': {
          inc: sinon.stub(),
        },
      },
    })

    return (this.stubbedNotification = [
      {
        key: notificationKey,
        messageOpts: 'some info',
        templateKey: 'template-key',
      },
    ])
  })

  describe('getUserNotifications', function () {
    return it('should ask the notifications for the users notifications', function (done) {
      this.notifications.getUserNotifications = sinon
        .stub()
        .callsArgWith(1, null, this.stubbedNotification)
      const req = {
        params: {
          user_id: userId,
        },
      }
      return this.controller.getUserNotifications(req, {
        json: result => {
          result.should.equal(this.stubbedNotification)
          this.notifications.getUserNotifications
            .calledWith(userId)
            .should.equal(true)
          return done()
        },
      })
    })
  })

  describe('addNotification', function () {
    return it('should tell the notifications to add the notification for the user', function (done) {
      this.notifications.addNotification = sinon.stub().callsArgWith(2)
      const req = {
        params: {
          user_id: userId,
        },
        body: this.stubbedNotification,
      }
      return this.controller.addNotification(req, {
        sendStatus: code => {
          this.notifications.addNotification
            .calledWith(userId, this.stubbedNotification)
            .should.equal(true)
          code.should.equal(200)
          return done()
        },
      })
    })
  })

  describe('removeNotificationId', function () {
    return it('should tell the notifications to mark the notification Id as read', function (done) {
      this.notifications.removeNotificationId = sinon.stub().callsArgWith(2)
      const req = {
        params: {
          user_id: userId,
          notification_id: notificationId,
        },
      }
      return this.controller.removeNotificationId(req, {
        sendStatus: code => {
          this.notifications.removeNotificationId
            .calledWith(userId, notificationId)
            .should.equal(true)
          code.should.equal(200)
          return done()
        },
      })
    })
  })

  describe('removeNotificationKey', function () {
    return it('should tell the notifications to mark the notification Key as read', function (done) {
      this.notifications.removeNotificationKey = sinon.stub().callsArgWith(2)
      const req = {
        params: {
          user_id: userId,
        },
        body: { key: notificationKey },
      }
      return this.controller.removeNotificationKey(req, {
        sendStatus: code => {
          this.notifications.removeNotificationKey
            .calledWith(userId, notificationKey)
            .should.equal(true)
          code.should.equal(200)
          return done()
        },
      })
    })
  })

  return describe('removeNotificationByKeyOnly', function () {
    return it('should tell the notifications to mark the notification Key as read', function (done) {
      this.notifications.removeNotificationByKeyOnly = sinon
        .stub()
        .callsArgWith(1)
      const req = {
        params: {
          key: notificationKey,
        },
      }
      return this.controller.removeNotificationByKeyOnly(req, {
        sendStatus: code => {
          this.notifications.removeNotificationByKeyOnly
            .calledWith(notificationKey)
            .should.equal(true)
          code.should.equal(200)
          return done()
        },
      })
    })
  })
})
