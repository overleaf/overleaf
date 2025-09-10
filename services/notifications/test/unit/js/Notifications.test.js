import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ObjectId } from 'mongodb-legacy'
import assert from 'node:assert'
const modulePath = '../../../app/js/Notifications.js'

const userId = '51dc93e6fb625a261300003b'
const notificationId = '574ee8d6f40c3a244e704249'
const notificationKey = 'notification-key'

describe('Notifications Tests', () => {
  let countStub,
    db,
    deleteOneStub,
    findStub,
    findToArrayStub,
    notifications,
    stubbedNotification,
    stubbedNotificationArray,
    updateOneStub
  beforeEach(async () => {
    findToArrayStub = vi.fn()
    findStub = vi.fn().mockReturnValue({ toArray: findToArrayStub })
    countStub = vi.fn()
    updateOneStub = vi.fn()
    deleteOneStub = vi.fn()
    db = {
      notifications: {
        find: findStub,
        count: countStub,
        updateOne: updateOneStub,
        deleteOne: deleteOneStub,
      },
    }

    vi.doMock('@overleaf/settings', () => ({}))
    vi.doMock('../../../app/js/mongodb', () => ({
      db,
      ObjectId,
    }))

    notifications = (await import(modulePath)).default

    stubbedNotification = {
      user_id: new ObjectId(userId),
      key: 'notification-key',
      messageOpts: 'some info',
      templateKey: 'template-key',
    }
    stubbedNotificationArray = [stubbedNotification]
  })

  describe('getUserNotifications', () => {
    it('should find all notifications and return i', async () => {
      findToArrayStub.mockResolvedValue(stubbedNotificationArray)
      const result = await notifications.getUserNotifications(userId)

      result.should.equal(stubbedNotificationArray)
      assert.deepEqual(findStub.mock.calls[0][0], {
        user_id: new ObjectId(userId),
        templateKey: { $exists: true },
      })
    })
  })

  describe('addNotification', () => {
    let expectedDocument, expectedQuery
    beforeEach(() => {
      stubbedNotification = {
        user_id: new ObjectId(userId),
        key: 'notification-key',
        messageOpts: 'some info',
        templateKey: 'template-key',
      }
      expectedDocument = {
        user_id: stubbedNotification.user_id,
        key: 'notification-key',
        messageOpts: 'some info',
        templateKey: 'template-key',
      }
      expectedQuery = {
        user_id: stubbedNotification.user_id,
        key: 'notification-key',
      }
      updateOneStub.mockResolvedValue()
      countStub.mockResolvedValue(0)
    })

    it('should insert the notification into the collection', async () => {
      await notifications.addNotification(userId, stubbedNotification)

      expect(updateOneStub).toHaveBeenCalledWith(
        expectedQuery,
        { $set: expectedDocument },
        { upsert: true }
      )
    })

    describe('when there is an existing notification', done => {
      beforeEach(() => {
        countStub.mockResolvedValue(1)
      })

      it('should fail to insert', async () => {
        await notifications.addNotification(userId, stubbedNotification)

        expect(updateOneStub).not.toHaveBeenCalled()
      })

      it('should update the key if forceCreate is true', async () => {
        stubbedNotification.forceCreate = true
        await notifications.addNotification(userId, stubbedNotification)

        expect(updateOneStub).toHaveBeenCalledWith(
          expectedQuery,
          { $set: expectedDocument },
          { upsert: true }
        )
      })
    })

    describe('when the notification is set to expire', () => {
      beforeEach(() => {
        stubbedNotification = {
          user_id: new ObjectId(userId),
          key: 'notification-key',
          messageOpts: 'some info',
          templateKey: 'template-key',
          expires: '2922-02-13T09:32:56.289Z',
        }
        expectedDocument = {
          user_id: stubbedNotification.user_id,
          key: 'notification-key',
          messageOpts: 'some info',
          templateKey: 'template-key',
          expires: new Date(stubbedNotification.expires),
        }
        expectedQuery = {
          user_id: stubbedNotification.user_id,
          key: 'notification-key',
        }
      })

      it('should add an `expires` Date field to the document', async () => {
        await notifications.addNotification(userId, stubbedNotification)

        expect(updateOneStub).toHaveBeenCalledWith(
          expectedQuery,
          { $set: expectedDocument },
          { upsert: true }
        )
      })
    })

    describe('when the notification has a nonsensical expires field', () => {
      beforeEach(() => {
        stubbedNotification = {
          user_id: new ObjectId(userId),
          key: 'notification-key',
          messageOpts: 'some info',
          templateKey: 'template-key',
          expires: 'WAT',
        }
        expectedDocument = {
          user_id: stubbedNotification.user_id,
          key: 'notification-key',
          messageOpts: 'some info',
          templateKey: 'template-key',
          expires: new Date(stubbedNotification.expires),
        }
      })

      it('should produce an error', async () => {
        await expect(
          notifications.addNotification(userId, stubbedNotification)
        ).to.eventually.be.rejectedWith(Error)

        expect(updateOneStub).not.toHaveBeenCalled()
      })
    })
  })

  describe('removeNotificationId', () => {
    it('should mark the notification id as read', async () => {
      updateOneStub.mockResolvedValue(null)

      await notifications.removeNotificationId(userId, notificationId)

      const searchOps = {
        user_id: new ObjectId(userId),
        _id: new ObjectId(notificationId),
      }
      const updateOperation = {
        $unset: { templateKey: true, messageOpts: true },
      }
      assert.deepEqual(updateOneStub.mock.calls[0][0], searchOps)
      assert.deepEqual(updateOneStub.mock.calls[0][1], updateOperation)
    })
  })

  describe('removeNotificationKey', () => {
    it('should mark the notification key as read', async () => {
      updateOneStub.mockResolvedValue(null)

      await notifications.removeNotificationKey(userId, notificationKey)
      const searchOps = {
        user_id: new ObjectId(userId),
        key: notificationKey,
      }
      const updateOperation = {
        $unset: { templateKey: true },
      }
      assert.deepEqual(updateOneStub.mock.calls[0][0], searchOps)
      assert.deepEqual(updateOneStub.mock.calls[0][1], updateOperation)
    })
  })

  describe('removeNotificationByKeyOnly', () => {
    it('should mark the notification key as read', async () => {
      updateOneStub.mockResolvedValue(null)

      await notifications.removeNotificationByKeyOnly(notificationKey)
      const searchOps = { key: notificationKey }
      const updateOperation = { $unset: { templateKey: true } }
      assert.deepEqual(updateOneStub.mock.calls[0][0], searchOps)
      assert.deepEqual(updateOneStub.mock.calls[0][1], updateOperation)
    })
  })

  describe('deleteNotificationByKeyOnly', () => {
    it('should completely remove the notification', async () => {
      deleteOneStub.mockResolvedValue()

      await notifications.deleteNotificationByKeyOnly(notificationKey)

      const searchOps = { key: notificationKey }
      expect(deleteOneStub.mock.calls[0][0]).toEqual(searchOps)
    })
  })
})
