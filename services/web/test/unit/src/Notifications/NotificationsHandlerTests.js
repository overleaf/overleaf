const SandboxedModule = require('sandboxed-module')
const { assert } = require('chai')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Notifications/NotificationsHandler.js'
)

describe('NotificationsHandler', function () {
  const userId = '123nd3ijdks'
  const notificationId = '123njdskj9jlk'
  const notificationUrl = 'notification.overleaf.testing'

  beforeEach(function () {
    this.request = sinon.stub().callsArgWith(1)
    this.handler = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': {
          apis: { notifications: { url: notificationUrl } },
        },
        request: this.request,
      },
    })
  })

  describe('getUserNotifications', function () {
    it('should get unread notifications', async function () {
      const stubbedNotifications = [{ _id: notificationId, user_id: userId }]
      this.request.callsArgWith(
        1,
        null,
        { statusCode: 200 },
        stubbedNotifications
      )
      const unreadNotifications =
        await this.handler.promises.getUserNotifications(userId)
      stubbedNotifications.should.deep.equal(unreadNotifications)
      const getOpts = {
        uri: `${notificationUrl}/user/${userId}`,
        json: true,
        timeout: 1000,
        method: 'GET',
      }
      this.request.calledWith(getOpts).should.equal(true)
    })

    it('should return empty arrays if there are no notifications', async function () {
      this.request.callsArgWith(1, null, { statusCode: 200 }, null)
      const unreadNotifications =
        await this.handler.promises.getUserNotifications(userId)
      unreadNotifications.length.should.equal(0)
    })
  })

  describe('markAsRead', function () {
    beforeEach(function () {
      this.key = 'some key here'
    })

    it('should send a delete request when a delete has been received to mark a notification', async function () {
      await this.handler.promises.markAsReadWithKey(userId, this.key)
      const opts = {
        uri: `${notificationUrl}/user/${userId}`,
        json: {
          key: this.key,
        },
        timeout: 1000,
        method: 'DELETE',
      }
      this.request.calledWith(opts).should.equal(true)
    })
  })

  describe('createNotification', function () {
    beforeEach(function () {
      this.key = 'some key here'
      this.messageOpts = { value: 12344 }
      this.templateKey = 'renderThisHtml'
      this.expiry = null
    })

    it('should post the message over', async function () {
      await this.handler.promises.createNotification(
        userId,
        this.key,
        this.templateKey,
        this.messageOpts,
        this.expiry
      )
      const args = this.request.args[0][0]
      args.uri.should.equal(`${notificationUrl}/user/${userId}`)
      args.timeout.should.equal(1000)
      const expectedJson = {
        key: this.key,
        templateKey: this.templateKey,
        messageOpts: this.messageOpts,
        forceCreate: true,
      }
      assert.deepEqual(args.json, expectedJson)
    })

    describe('when expiry date is supplied', function () {
      beforeEach(function () {
        this.key = 'some key here'
        this.messageOpts = { value: 12344 }
        this.templateKey = 'renderThisHtml'
        this.expiry = new Date()
      })

      it('should post the message over with expiry field', async function () {
        await this.handler.promises.createNotification(
          userId,
          this.key,
          this.templateKey,
          this.messageOpts,
          this.expiry
        )

        const args = this.request.args[0][0]
        args.uri.should.equal(`${notificationUrl}/user/${userId}`)
        args.timeout.should.equal(1000)
        const expectedJson = {
          key: this.key,
          templateKey: this.templateKey,
          messageOpts: this.messageOpts,
          expires: this.expiry,
          forceCreate: true,
        }
        assert.deepEqual(args.json, expectedJson)
      })
    })
  })

  describe('markAsReadByKeyOnly', function () {
    beforeEach(function () {
      this.key = 'some key here'
    })

    it('should send a delete request when a delete has been received to mark a notification', async function () {
      await this.handler.promises.markAsReadByKeyOnly(this.key)
      const opts = {
        uri: `${notificationUrl}/key/${this.key}`,
        timeout: 1000,
        method: 'DELETE',
      }
      this.request.calledWith(opts).should.equal(true)
    })
  })
})
