// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
const modulePath = '../../../app/js/NotificationsController.js'

const userId = '51dc93e6fb625a261300003b'
const notificationId = 'fb625a26f09d'
const notificationKey = 'my-notification-key'

describe('Notifications Controller', () => {
  let controller, notifications, stubbedNotification
  beforeEach(async () => {
    notifications = {
      addNotification: vi.fn(),
      getUserNotifications: vi.fn(),
      removeNotificationByKeyOnly: vi.fn(),
      removeNotificationId: vi.fn(),
      removeNotificationKey: vi.fn(),
    }

    vi.doMock('../../../app/js/Notifications', () => ({
      default: notifications,
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        inc: vi.fn(),
      },
    }))

    controller = (await import(modulePath)).default

    stubbedNotification = [
      {
        key: notificationKey,
        messageOpts: 'some info',
        templateKey: 'template-key',
      },
    ]
  })

  describe('getUserNotifications', () => {
    it('should ask the notifications for the users notifications', async () => {
      notifications.getUserNotifications.mockResolvedValue(stubbedNotification)
      const req = {
        params: {
          user_id: userId,
        },
      }
      await new Promise(resolve => {
        controller.getUserNotifications(req, {
          json: result => {
            expect(result).toBe(stubbedNotification)
            expect(notifications.getUserNotifications).toHaveBeenCalledWith(
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
      notifications.addNotification.mockResolvedValue()
      const req = {
        params: {
          user_id: userId,
        },
        body: stubbedNotification,
      }
      await new Promise(resolve => {
        controller.addNotification(req, {
          sendStatus: code => {
            expect(notifications.addNotification).toHaveBeenCalledWith(
              userId,
              stubbedNotification
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
      notifications.removeNotificationId.mockResolvedValue()
      const req = {
        params: {
          user_id: userId,
          notification_id: notificationId,
        },
      }
      await new Promise(resolve => {
        controller.removeNotificationId(req, {
          sendStatus: code => {
            expect(notifications.removeNotificationId).toHaveBeenCalledWith(
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
      notifications.removeNotificationKey.mockResolvedValue()
      const req = {
        params: {
          user_id: userId,
        },
        body: { key: notificationKey },
      }
      await new Promise(resolve => {
        controller.removeNotificationKey(req, {
          sendStatus: code => {
            expect(notifications.removeNotificationKey).toHaveBeenCalledWith(
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
      notifications.removeNotificationByKeyOnly.mockResolvedValue()
      const req = {
        params: {
          key: notificationKey,
        },
      }
      await new Promise(resolve =>
        controller.removeNotificationByKeyOnly(req, {
          sendStatus: code => {
            expect(
              notifications.removeNotificationByKeyOnly
            ).toHaveBeenCalledWith(notificationKey)

            expect(code).toBe(200)
            resolve()
          },
        })
      )
    })
  })
})
