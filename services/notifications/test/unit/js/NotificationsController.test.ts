import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationsController from '../../../app/js/NotificationsController.ts'
import Notifications from '../../../app/js/Notifications.js'
import { ObjectId } from 'mongodb-legacy'
const modulePath = '../../../app/js/NotificationsController.js'

const userId = '51dc93e6fb625a261300003b'
const notificationId = '51dc93e6fb625a261300003c'
const notificationKey = 'my-notification-key'

vi.mock('../../../app/js/Notifications', () => ({
  default: {
    addNotification: vi.fn(),
    getUserNotifications: vi.fn(),
    removeNotificationByKeyOnly: vi.fn(),
    removeNotificationId: vi.fn(),
    removeNotificationKey: vi.fn(),
  },
}))

interface InputNotification {
  user_id: string
  key: string
  messageOpts?: object
  templateKey?: string
}

interface DatabaseNotification {
  _id: ObjectId
  user_id: ObjectId
  key: string
  messageOpts?: object
  templateKey?: string
}

function convertInputNotificationToDatabaseNotification(
  inputNotification: InputNotification
): DatabaseNotification {
  return {
    ...inputNotification,
    _id: new ObjectId(),
    user_id: new ObjectId(inputNotification.user_id),
  }
}

describe('Notifications Controller', () => {
  let controller: typeof NotificationsController,
    stubbedNotification: Array<InputNotification>
  beforeEach(async () => {
    vi.doMock('@overleaf/metrics', () => ({
      default: {
        inc: vi.fn(),
        mongodb: {
          monitor: vi.fn(),
        },
      },
    }))

    controller = (await import(modulePath)).default

    stubbedNotification = [
      {
        user_id: new ObjectId().toString(),
        key: notificationKey,
        messageOpts: { info: 'some info' },
        templateKey: 'template-key',
      },
    ]
  })

  describe('getUserNotifications', () => {
    it('should ask the notifications for the users notifications', async () => {
      const databaseNotifications = stubbedNotification.map(
        convertInputNotificationToDatabaseNotification
      )
      vi.mocked(Notifications.getUserNotifications).mockResolvedValue(
        databaseNotifications
      )
      const req = {
        params: {
          user_id: userId,
        },
      }
      await new Promise<void>(resolve => {
        controller.getUserNotifications(req, {
          json: result => {
            expect(result).toBe(databaseNotifications)
            expect(Notifications.getUserNotifications).toHaveBeenCalledWith(
              userId
            )
            resolve()
          },
        })
      })
    })
  })

  describe('addNotification', () => {
    it('should tell the notifications to add the notification for the user', async () => {
      vi.mocked(Notifications.addNotification).mockResolvedValue({
        acknowledged: true,
        upsertedId: new ObjectId(),
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
      })
      const req = {
        params: {
          user_id: userId,
        },
        body: stubbedNotification[0],
      }
      await new Promise<void>(resolve => {
        controller.addNotification(req, {
          sendStatus: code => {
            expect(Notifications.addNotification).toHaveBeenCalledWith(
              userId,
              stubbedNotification[0]
            )
            expect(code).toBe(200)
            resolve()
          },
        })
      })
    })
  })

  describe('removeNotificationId', () => {
    it('should tell the notifications to mark the notification Id as read', async () => {
      vi.mocked(Notifications.removeNotificationId).mockResolvedValue({
        acknowledged: true,
        upsertedId: null,
        upsertedCount: 0,
        matchedCount: 1,
        modifiedCount: 1,
      })
      const req = {
        params: {
          user_id: userId,
          notification_id: notificationId,
        },
      }
      await new Promise<void>(resolve => {
        controller.removeNotificationId(req, {
          sendStatus: code => {
            expect(Notifications.removeNotificationId).toHaveBeenCalledWith(
              userId,
              notificationId
            )
            expect(code).toBe(200)
            resolve()
          },
        })
      })
    })
  })

  describe('removeNotificationKey', () => {
    it('should tell the notifications to mark the notification Key as read', async () => {
      vi.mocked(Notifications.removeNotificationKey).mockResolvedValue({
        acknowledged: true,
        upsertedId: null,
        upsertedCount: 0,
        matchedCount: 1,
        modifiedCount: 1,
      })
      const req = {
        params: {
          user_id: userId,
        },
        body: { key: notificationKey },
      }
      await new Promise<void>(resolve => {
        controller.removeNotificationKey(req, {
          sendStatus: code => {
            expect(Notifications.removeNotificationKey).toHaveBeenCalledWith(
              userId,
              notificationKey
            )
            expect(code).toBe(200)
            resolve()
          },
        })
      })
    })
  })

  describe('removeNotificationByKeyOnly', () => {
    it('should tell the notifications to mark the notification Key as read', async () => {
      vi.mocked(Notifications.removeNotificationByKeyOnly).mockResolvedValue({
        acknowledged: true,
        upsertedId: null,
        upsertedCount: 0,
        matchedCount: 1,
        modifiedCount: 1,
      })
      const req = {
        params: {
          key: notificationKey,
        },
      }
      await new Promise<void>(resolve =>
        controller.removeNotificationByKeyOnly(req, {
          sendStatus: code => {
            expect(
              Notifications.removeNotificationByKeyOnly
            ).toHaveBeenCalledWith(notificationKey)

            expect(code).toBe(200)
            resolve()
          },
        })
      )
    })
  })
})
