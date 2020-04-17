/* eslint-disable
    camelcase,
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
const chai = require('chai')
const should = chai.should()
const modulePath = '../../../app/js/NotificationsController.js'
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')

const user_id = '51dc93e6fb625a261300003b'
const notification_id = 'fb625a26f09d'
const notification_key = 'my-notification-key'

describe('Notifications Controller', function() {
  beforeEach(function() {
    const self = this
    this.notifications = {}
    this.controller = SandboxedModule.require(modulePath, {
      requires: {
        'logger-sharelatex': { log() {} },
        './Notifications': this.notifications,
        'metrics-sharelatex': {
          inc: sinon.stub()
        }
      }
    })

    return (this.stubbedNotification = [
      {
        key: notification_key,
        messageOpts: 'some info',
        templateKey: 'template-key'
      }
    ])
  })

  describe('getUserNotifications', function() {
    return it('should ask the notifications for the users notifications', function(done) {
      this.notifications.getUserNotifications = sinon
        .stub()
        .callsArgWith(1, null, this.stubbedNotification)
      const req = {
        params: {
          user_id
        }
      }
      return this.controller.getUserNotifications(req, {
        json: result => {
          result.should.equal(this.stubbedNotification)
          this.notifications.getUserNotifications
            .calledWith(user_id)
            .should.equal(true)
          return done()
        }
      })
    })
  })

  describe('addNotification', function() {
    return it('should tell the notifications to add the notification for the user', function(done) {
      this.notifications.addNotification = sinon.stub().callsArgWith(2)
      const req = {
        params: {
          user_id
        },
        body: this.stubbedNotification
      }
      return this.controller.addNotification(req, {
        sendStatus: code => {
          this.notifications.addNotification
            .calledWith(user_id, this.stubbedNotification)
            .should.equal(true)
          code.should.equal(200)
          return done()
        }
      })
    })
  })

  describe('removeNotificationId', function() {
    return it('should tell the notifications to mark the notification Id as read', function(done) {
      this.notifications.removeNotificationId = sinon.stub().callsArgWith(2)
      const req = {
        params: {
          user_id,
          notification_id
        }
      }
      return this.controller.removeNotificationId(req, {
        sendStatus: code => {
          this.notifications.removeNotificationId
            .calledWith(user_id, notification_id)
            .should.equal(true)
          code.should.equal(200)
          return done()
        }
      })
    })
  })

  describe('removeNotificationKey', function() {
    return it('should tell the notifications to mark the notification Key as read', function(done) {
      this.notifications.removeNotificationKey = sinon.stub().callsArgWith(2)
      const req = {
        params: {
          user_id
        },
        body: { key: notification_key }
      }
      return this.controller.removeNotificationKey(req, {
        sendStatus: code => {
          this.notifications.removeNotificationKey
            .calledWith(user_id, notification_key)
            .should.equal(true)
          code.should.equal(200)
          return done()
        }
      })
    })
  })

  return describe('removeNotificationByKeyOnly', function() {
    return it('should tell the notifications to mark the notification Key as read', function(done) {
      this.notifications.removeNotificationByKeyOnly = sinon
        .stub()
        .callsArgWith(1)
      const req = {
        params: {
          key: notification_key
        }
      }
      return this.controller.removeNotificationByKeyOnly(req, {
        sendStatus: code => {
          this.notifications.removeNotificationByKeyOnly
            .calledWith(notification_key)
            .should.equal(true)
          code.should.equal(200)
          return done()
        }
      })
    })
  })
})
