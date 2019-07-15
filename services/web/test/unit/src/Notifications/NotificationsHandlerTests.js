/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
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
const SandboxedModule = require('sandboxed-module')
const { assert } = require('chai')
require('chai').should()
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Notifications/NotificationsHandler.js'
)
const _ = require('underscore')

describe('NotificationsHandler', function() {
  const user_id = '123nd3ijdks'
  const notification_id = '123njdskj9jlk'
  const notificationUrl = 'notification.sharelatex.testing'

  beforeEach(function() {
    this.request = sinon.stub().callsArgWith(1)
    return (this.handler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': {
          apis: { notifications: { url: notificationUrl } }
        },
        request: this.request,
        'logger-sharelatex': {
          log() {},
          err() {}
        }
      }
    }))
  })

  describe('getUserNotifications', function() {
    it('should get unread notifications', function(done) {
      const stubbedNotifications = [{ _id: notification_id, user_id }]
      this.request.callsArgWith(
        1,
        null,
        { statusCode: 200 },
        stubbedNotifications
      )
      return this.handler.getUserNotifications(
        user_id,
        (err, unreadNotifications) => {
          stubbedNotifications.should.deep.equal(unreadNotifications)
          const getOpts = {
            uri: `${notificationUrl}/user/${user_id}`,
            json: true,
            timeout: 1000,
            method: 'GET'
          }
          this.request.calledWith(getOpts).should.equal(true)
          return done()
        }
      )
    })

    it('should return empty arrays if there are no notifications', function() {
      this.request.callsArgWith(1, null, { statusCode: 200 }, null)
      return this.handler.getUserNotifications(
        user_id,
        (err, unreadNotifications) => {
          return unreadNotifications.length.should.equal(0)
        }
      )
    })
  })

  describe('markAsRead', function() {
    beforeEach(function() {
      return (this.key = 'some key here')
    })

    it('should send a delete request when a delete has been received to mark a notification', function(done) {
      return this.handler.markAsReadWithKey(user_id, this.key, () => {
        const opts = {
          uri: `${notificationUrl}/user/${user_id}`,
          json: {
            key: this.key
          },
          timeout: 1000,
          method: 'DELETE'
        }
        this.request.calledWith(opts).should.equal(true)
        return done()
      })
    })
  })

  describe('createNotification', function() {
    beforeEach(function() {
      this.key = 'some key here'
      this.messageOpts = { value: 12344 }
      this.templateKey = 'renderThisHtml'
      return (this.expiry = null)
    })

    it('should post the message over', function(done) {
      return this.handler.createNotification(
        user_id,
        this.key,
        this.templateKey,
        this.messageOpts,
        this.expiry,
        () => {
          const args = this.request.args[0][0]
          args.uri.should.equal(`${notificationUrl}/user/${user_id}`)
          args.timeout.should.equal(1000)
          const expectedJson = {
            key: this.key,
            templateKey: this.templateKey,
            messageOpts: this.messageOpts,
            forceCreate: true
          }
          assert.deepEqual(args.json, expectedJson)
          return done()
        }
      )
    })

    describe('when expiry date is supplied', function() {
      beforeEach(function() {
        this.key = 'some key here'
        this.messageOpts = { value: 12344 }
        this.templateKey = 'renderThisHtml'
        return (this.expiry = new Date())
      })

      it('should post the message over with expiry field', function(done) {
        return this.handler.createNotification(
          user_id,
          this.key,
          this.templateKey,
          this.messageOpts,
          this.expiry,
          () => {
            const args = this.request.args[0][0]
            args.uri.should.equal(`${notificationUrl}/user/${user_id}`)
            args.timeout.should.equal(1000)
            const expectedJson = {
              key: this.key,
              templateKey: this.templateKey,
              messageOpts: this.messageOpts,
              expires: this.expiry,
              forceCreate: true
            }
            assert.deepEqual(args.json, expectedJson)
            return done()
          }
        )
      })
    })
  })

  describe('markAsReadByKeyOnly', function() {
    beforeEach(function() {
      return (this.key = 'some key here')
    })

    it('should send a delete request when a delete has been received to mark a notification', function(done) {
      return this.handler.markAsReadByKeyOnly(this.key, () => {
        const opts = {
          uri: `${notificationUrl}/key/${this.key}`,
          timeout: 1000,
          method: 'DELETE'
        }
        this.request.calledWith(opts).should.equal(true)
        return done()
      })
    })
  })
})
