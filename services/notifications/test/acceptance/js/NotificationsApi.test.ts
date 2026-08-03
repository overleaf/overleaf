import { beforeAll, beforeEach, describe, it, expect } from 'vitest'
import app from '../../../app.ts'
import { db, ObjectId } from '../../../app/js/mongodb.js'
import { expectValidationError } from '@overleaf/validation-tools/testUtils.js'
import './MongoHelper.ts'

// Use a dedicated port: HealthCheck.test.ts owns the default port (3042) and
// the vitest workers may run both files in parallel processes.
const HOST = '127.0.0.1'
const PORT = 23042
const BASE_URL = `http://${HOST}:${PORT}`

let runAppPromise: Promise<void> | null = null

async function ensureRunning() {
  if (!runAppPromise) {
    runAppPromise = new Promise(resolve => {
      app.listen(PORT, HOST, () => resolve())
    })
  }
  await runAppPromise
}

function notificationPayload(key: string) {
  return {
    key,
    messageOpts: { projectName: 'A Project' },
    templateKey: 'notification_project_invite',
  }
}

async function addNotification(userId: string, payload: object) {
  return await fetch(`${BASE_URL}/user/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

async function getNotifications(userId: string) {
  const response = await fetch(`${BASE_URL}/user/${userId}`)
  expect(response.status).toBe(200)
  return (await response.json()) as Array<{
    _id: string
    user_id: string
    key: string
    templateKey?: string
    messageOpts?: { projectName: string }
  }>
}

describe('Notifications API', () => {
  let userId: string
  let key: string

  beforeAll(async () => {
    await ensureRunning()
  })

  beforeEach(() => {
    userId = new ObjectId().toString()
    key = `test-key-${new ObjectId().toString()}`
  })

  describe('POST /user/:user_id', () => {
    it('should add a notification', async () => {
      const response = await addNotification(userId, notificationPayload(key))
      expect(response.status).toBe(200)

      const notifications = await getNotifications(userId)
      expect(notifications).toHaveLength(1)
      expect(notifications[0].user_id).toBe(userId)
      expect(notifications[0].key).toBe(key)
      expect(notifications[0].templateKey).toBe('notification_project_invite')
      expect(notifications[0].messageOpts).toEqual({
        projectName: 'A Project',
      })
    })

    it('should not add a duplicate notification for the same key', async () => {
      const first = await addNotification(userId, notificationPayload(key))
      expect(first.status).toBe(200)
      const second = await addNotification(userId, {
        ...notificationPayload(key),
        messageOpts: { projectName: 'Another Project' },
      })
      expect(second.status).toBe(200)

      const notifications = await getNotifications(userId)
      expect(notifications).toHaveLength(1)
      expect(notifications[0].messageOpts).toEqual({
        projectName: 'A Project',
      })
    })

    it('should overwrite an existing notification with forceCreate', async () => {
      const first = await addNotification(userId, notificationPayload(key))
      expect(first.status).toBe(200)
      const second = await addNotification(userId, {
        ...notificationPayload(key),
        messageOpts: { projectName: 'Another Project' },
        forceCreate: true,
      })
      expect(second.status).toBe(200)

      const notifications = await getNotifications(userId)
      expect(notifications).toHaveLength(1)
      expect(notifications[0].messageOpts).toEqual({
        projectName: 'Another Project',
      })
    })

    it('should return a 404 for a malformed user id', async () => {
      const response = await addNotification(
        'not-an-object-id',
        notificationPayload(key)
      )
      const body = await response.json()
      expectValidationError({ response, body }, 404, 'user_id')
    })

    it('should return a 400 for an unknown field in the notification body', async () => {
      const response = await addNotification(userId, {
        ...notificationPayload(key),
        notAField: true,
      })
      const body = await response.json()
      expectValidationError({ response, body }, 400, 'notAField')
    })

    it('should return a 400 for an invalid expires field', async () => {
      const response = await addNotification(userId, {
        ...notificationPayload(key),
        expires: 'not-a-date',
      })
      const body = await response.json()
      expectValidationError({ response, body }, 400, 'expires')
    })
  })

  describe('GET /user/:user_id', () => {
    it('should return the unread notifications of the user', async () => {
      await addNotification(userId, notificationPayload(key))
      const notifications = await getNotifications(userId)
      expect(notifications).toHaveLength(1)
      expect(notifications[0].key).toBe(key)
    })

    it('should return an empty list for a user without notifications', async () => {
      const notifications = await getNotifications(userId)
      expect(notifications).toEqual([])
    })

    it('should return a 404 for a malformed user id', async () => {
      const response = await fetch(`${BASE_URL}/user/not-an-object-id`)
      const body = await response.json()
      expectValidationError({ response, body }, 404, 'user_id')
    })
  })

  describe('DELETE /user/:user_id/notification/:notification_id', () => {
    it('should mark the notification as read', async () => {
      await addNotification(userId, notificationPayload(key))
      const [notification] = await getNotifications(userId)

      const response = await fetch(
        `${BASE_URL}/user/${userId}/notification/${notification._id}`,
        { method: 'DELETE' }
      )
      expect(response.status).toBe(200)
      expect(await getNotifications(userId)).toEqual([])
    })

    it('should return a 404 for a malformed notification id', async () => {
      const response = await fetch(
        `${BASE_URL}/user/${userId}/notification/not-an-object-id`,
        { method: 'DELETE' }
      )
      const body = await response.json()
      expectValidationError({ response, body }, 404, 'notification_id')
    })
  })

  describe('DELETE /user/:user_id', () => {
    it('should mark the notification with the given key as read', async () => {
      await addNotification(userId, notificationPayload(key))

      const response = await fetch(`${BASE_URL}/user/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      expect(response.status).toBe(200)
      expect(await getNotifications(userId)).toEqual([])
    })

    it('should return a 400 when the key is missing from the body', async () => {
      const response = await fetch(`${BASE_URL}/user/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const body = await response.json()
      expectValidationError({ response, body }, 400, 'key')
    })
  })

  describe('DELETE /key/:key', () => {
    it('should mark the notifications with the given key as read for all users', async () => {
      const otherUserId = new ObjectId().toString()
      await addNotification(userId, notificationPayload(key))
      await addNotification(otherUserId, notificationPayload(key))

      const response = await fetch(`${BASE_URL}/key/${key}`, {
        method: 'DELETE',
      })
      expect(response.status).toBe(200)

      // removeNotificationByKeyOnly only updates a single document
      const unread = [
        ...(await getNotifications(userId)),
        ...(await getNotifications(otherUserId)),
      ]
      expect(unread).toHaveLength(1)
    })

    it('should return a 404 without a key', async () => {
      // Note: this never reaches our zod schema or handleValidationError --
      // `:key` requires a non-empty segment, so `/key/` doesn't match the
      // route at all and Express's own default (HTML, non-JSON) 404 handler
      // responds instead. A body assertion doesn't apply here.
      const response = await fetch(`${BASE_URL}/key/`, { method: 'DELETE' })
      expect(response.status).toBe(404)
    })
  })

  describe('GET /key/:key/count', () => {
    it('should count the unread notifications with the given key', async () => {
      const otherUserId = new ObjectId().toString()
      await addNotification(userId, notificationPayload(key))
      await addNotification(otherUserId, notificationPayload(key))

      const response = await fetch(`${BASE_URL}/key/${key}/count`)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ count: 2 })
    })

    it('should return a zero count for an unknown key', async () => {
      const response = await fetch(`${BASE_URL}/key/${key}/count`)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ count: 0 })
    })
  })

  describe('DELETE /key/:key/bulk', () => {
    it('should delete all unread notifications with the given key', async () => {
      const otherUserId = new ObjectId().toString()
      await addNotification(userId, notificationPayload(key))
      await addNotification(otherUserId, notificationPayload(key))

      const response = await fetch(`${BASE_URL}/key/${key}/bulk`, {
        method: 'DELETE',
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ count: 2 })

      expect(await getNotifications(userId)).toEqual([])
      expect(await getNotifications(otherUserId)).toEqual([])
      expect(await db.notifications.countDocuments({ key })).toBe(0)
    })

    it('should return a zero count when there is nothing to delete', async () => {
      const response = await fetch(`${BASE_URL}/key/${key}/bulk`, {
        method: 'DELETE',
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ count: 0 })
    })
  })

  describe('GET /status', () => {
    it('should respond with a 200', async () => {
      const response = await fetch(`${BASE_URL}/status`)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('notifications is up')
    })
  })

  describe('unknown routes', () => {
    it('should respond with a 404', async () => {
      const response = await fetch(`${BASE_URL}/not-a-route`)
      expect(response.status).toBe(404)
    })
  })
})
