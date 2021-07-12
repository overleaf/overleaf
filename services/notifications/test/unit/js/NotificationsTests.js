/* eslint-disable
    camelcase,
    handle-callback-err,
    no-dupe-keys,
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
const { expect } = require('chai')
const modulePath = '../../../app/js/Notifications.js'
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const { ObjectId } = require('mongodb')

const user_id = '51dc93e6fb625a261300003b'
const notification_id = 'fb625a26f09d'
const notification_key = 'notification-key'

describe('Notifications Tests', function () {
  beforeEach(function () {
    this.findToArrayStub = sinon.stub()
    this.findStub = sinon.stub().returns({ toArray: this.findToArrayStub })
    this.countStub = sinon.stub()
    this.updateOneStub = sinon.stub()
    this.deleteOneStub = sinon.stub()
    this.db = {
      notifications: {
        find: this.findStub,
        count: this.countStub,
        updateOne: this.updateOneStub,
        deleteOne: this.deleteOneStub
      }
    }

    this.notifications = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': {},
        './mongodb': { db: this.db, ObjectId },
        '@overleaf/metrics': { timeAsyncMethod: sinon.stub() }
      }
    })

    this.stubbedNotification = {
      user_id: ObjectId(user_id),
      key: 'notification-key',
      messageOpts: 'some info',
      templateKey: 'template-key'
    }
    return (this.stubbedNotificationArray = [this.stubbedNotification])
  })

  describe('getUserNotifications', function () {
    return it('should find all notifications and return i', function (done) {
      this.findToArrayStub.callsArgWith(0, null, this.stubbedNotificationArray)
      return this.notifications.getUserNotifications(
        user_id,
        (err, notifications) => {
          notifications.should.equal(this.stubbedNotificationArray)
          assert.deepEqual(this.findStub.args[0][0], {
            user_id: ObjectId(user_id),
            templateKey: { $exists: true }
          })
          return done()
        }
      )
    })
  })

  describe('addNotification', function () {
    beforeEach(function () {
      this.stubbedNotification = {
        user_id: ObjectId(user_id),
        key: 'notification-key',
        messageOpts: 'some info',
        templateKey: 'template-key'
      }
      this.expectedDocument = {
        user_id: this.stubbedNotification.user_id,
        key: 'notification-key',
        messageOpts: 'some info',
        templateKey: 'template-key'
      }
      this.expectedQuery = {
        user_id: this.stubbedNotification.user_id,
        key: 'notification-key'
      }
      this.updateOneStub.yields()
      return this.countStub.yields(null, 0)
    })

    it('should insert the notification into the collection', function (done) {
      return this.notifications.addNotification(
        user_id,
        this.stubbedNotification,
        (err) => {
          expect(err).not.to.exist
          sinon.assert.calledWith(
            this.updateOneStub,
            this.expectedQuery,
            { $set: this.expectedDocument },
            { upsert: true }
          )
          return done()
        }
      )
    })

    describe('when there is an existing notification', function (done) {
      beforeEach(function () {
        return this.countStub.yields(null, 1)
      })

      it('should fail to insert', function (done) {
        return this.notifications.addNotification(
          user_id,
          this.stubbedNotification,
          (err) => {
            expect(err).not.to.exist
            sinon.assert.notCalled(this.updateOneStub)
            return done()
          }
        )
      })

      return it('should update the key if forceCreate is true', function (done) {
        this.stubbedNotification.forceCreate = true
        return this.notifications.addNotification(
          user_id,
          this.stubbedNotification,
          (err) => {
            expect(err).not.to.exist
            sinon.assert.calledWith(
              this.updateOneStub,
              this.expectedQuery,
              { $set: this.expectedDocument },
              { upsert: true }
            )
            return done()
          }
        )
      })
    })

    describe('when the notification is set to expire', function () {
      beforeEach(function () {
        this.stubbedNotification = {
          user_id: ObjectId(user_id),
          key: 'notification-key',
          messageOpts: 'some info',
          templateKey: 'template-key',
          expires: '2922-02-13T09:32:56.289Z'
        }
        this.expectedDocument = {
          user_id: this.stubbedNotification.user_id,
          key: 'notification-key',
          messageOpts: 'some info',
          templateKey: 'template-key',
          expires: new Date(this.stubbedNotification.expires)
        }
        return (this.expectedQuery = {
          user_id: this.stubbedNotification.user_id,
          key: 'notification-key'
        })
      })

      return it('should add an `expires` Date field to the document', function (done) {
        return this.notifications.addNotification(
          user_id,
          this.stubbedNotification,
          (err) => {
            expect(err).not.to.exist
            sinon.assert.calledWith(
              this.updateOneStub,
              this.expectedQuery,
              { $set: this.expectedDocument },
              { upsert: true }
            )
            return done()
          }
        )
      })
    })

    return describe('when the notification has a nonsensical expires field', function () {
      beforeEach(function () {
        this.stubbedNotification = {
          user_id: ObjectId(user_id),
          key: 'notification-key',
          messageOpts: 'some info',
          templateKey: 'template-key',
          expires: 'WAT'
        }
        return (this.expectedDocument = {
          user_id: this.stubbedNotification.user_id,
          key: 'notification-key',
          messageOpts: 'some info',
          templateKey: 'template-key',
          expires: new Date(this.stubbedNotification.expires)
        })
      })

      return it('should produce an error', function (done) {
        return this.notifications.addNotification(
          user_id,
          this.stubbedNotification,
          (err) => {
            ;(err instanceof Error).should.equal(true)
            sinon.assert.notCalled(this.updateOneStub)
            return done()
          }
        )
      })
    })
  })

  describe('removeNotificationId', function () {
    return it('should mark the notification id as read', function (done) {
      this.updateOneStub.callsArgWith(2, null)

      return this.notifications.removeNotificationId(
        user_id,
        notification_id,
        (err) => {
          const searchOps = {
            user_id: ObjectId(user_id),
            _id: ObjectId(notification_id)
          }
          const updateOperation = {
            $unset: { templateKey: true, messageOpts: true }
          }
          assert.deepEqual(this.updateOneStub.args[0][0], searchOps)
          assert.deepEqual(this.updateOneStub.args[0][1], updateOperation)
          return done()
        }
      )
    })
  })

  describe('removeNotificationKey', function () {
    return it('should mark the notification key as read', function (done) {
      this.updateOneStub.callsArgWith(2, null)

      return this.notifications.removeNotificationKey(
        user_id,
        notification_key,
        (err) => {
          const searchOps = {
            user_id: ObjectId(user_id),
            key: notification_key
          }
          const updateOperation = {
            $unset: { templateKey: true }
          }
          assert.deepEqual(this.updateOneStub.args[0][0], searchOps)
          assert.deepEqual(this.updateOneStub.args[0][1], updateOperation)
          return done()
        }
      )
    })
  })

  describe('removeNotificationByKeyOnly', function () {
    return it('should mark the notification key as read', function (done) {
      this.updateOneStub.callsArgWith(2, null)

      return this.notifications.removeNotificationByKeyOnly(
        notification_key,
        (err) => {
          const searchOps = { key: notification_key }
          const updateOperation = { $unset: { templateKey: true } }
          assert.deepEqual(this.updateOneStub.args[0][0], searchOps)
          assert.deepEqual(this.updateOneStub.args[0][1], updateOperation)
          return done()
        }
      )
    })
  })

  return describe('deleteNotificationByKeyOnly', function () {
    return it('should completely remove the notification', function (done) {
      this.deleteOneStub.callsArgWith(1, null)

      return this.notifications.deleteNotificationByKeyOnly(
        notification_key,
        (err) => {
          const searchOps = { key: notification_key }
          assert.deepEqual(this.deleteOneStub.args[0][0], searchOps)
          return done()
        }
      )
    })
  })
})
