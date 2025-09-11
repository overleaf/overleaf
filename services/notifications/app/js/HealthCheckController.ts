import { db, ObjectId } from './mongodb.js'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import {
  fetchJson,
  fetchNothing,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import { expressify } from '@overleaf/promise-utils'
import { z, zz } from '@overleaf/validation-tools'
import type { Request, Response } from 'express'

const { port } = settings.internal.notifications

function makeUrl(userId: string, endPath?: string) {
  return new URL(
    `/user/${userId}${endPath ? `/${endPath}` : ''}`,
    `http://127.0.0.1:${port}`
  )
}

async function makeNotification(notificationKey: string, userId: string) {
  const postOpts = {
    method: 'POST',
    json: {
      key: notificationKey,
      messageOpts: '',
      templateKey: 'f4g5',
      user_id: userId,
    },
    signal: AbortSignal.timeout(5000),
  }
  const url = makeUrl(userId)
  await fetchNothing(url, postOpts)
}

const getUserNotificationsResponseSchema = z
  .object({
    _id: zz.objectId(),
    key: z.string(),
    messageOpts: z.string().optional(),
    templateKey: z.string().optional(),
    user_id: zz.objectId(),
  })
  .array()

async function getUsersNotifications(userId: string) {
  const url = makeUrl(userId)
  try {
    const body = await fetchJson(url, {
      signal: AbortSignal.timeout(5000),
    })
    return getUserNotificationsResponseSchema.parse(body)
  } catch (err) {
    if (err instanceof RequestFailedError) {
      logger.err({ err }, 'Non-2xx status code received')
      throw err
    }
    logger.err({ err }, 'Health Check: error getting notification')
    throw err
  }
}

async function userHasNotification(userId: string, notificationKey: string) {
  const body = await getUsersNotifications(userId)
  const hasNotification = body.some(
    notification =>
      notification.key === notificationKey && notification.user_id === userId
  )
  if (hasNotification) {
    return body
  } else {
    logger.err(
      { body, notificationKey },
      'Health Check: notification not in response'
    )
    throw new Error('notification not found in response')
  }
}

async function cleanupNotifications(userId: string) {
  await db.notifications.deleteOne({ user_id: userId })
}

async function deleteNotification(
  userId: string,
  notificationId: string,
  notificationKey: string
) {
  const deleteByIdUrl = makeUrl(userId, `notification/${notificationId}`)
  try {
    await fetchNothing(deleteByIdUrl, {
      signal: AbortSignal.timeout(5000),
      method: 'DELETE',
    })
  } catch (err) {
    logger.err(
      { err, url: deleteByIdUrl },
      'Health Check: error cleaning up notification'
    )
    throw err
  }

  const deleteByKeyUrl = makeUrl(userId)

  try {
    await fetchNothing(deleteByKeyUrl, {
      signal: AbortSignal.timeout(5000),
      method: 'DELETE',
      json: {
        key: notificationKey,
      },
    })
  } catch (err) {
    logger.err(
      { err, url: deleteByKeyUrl },
      'Health Check: error cleaning up notification'
    )
    throw err
  }
}

async function check(req: Request, res: Response) {
  const userId = new ObjectId().toString()
  let notificationKey = `smoke-test-notification-${new ObjectId()}`

  logger.debug({ userId, key: notificationKey }, 'Health Check: running')

  await makeNotification(notificationKey, userId)
  try {
    const body = await userHasNotification(userId, notificationKey)
    const notificationId = body[0]._id
    notificationKey = body[0].key
    logger.debug(
      { notificationId, notificationKey },
      'Health Check: doing cleanup'
    )
    await deleteNotification(userId, notificationId, notificationKey)
    res.sendStatus(200)
  } catch (err) {
    logger.err({ err }, 'Health Check: error running health check')
    res.sendStatus(500)
  } finally {
    await cleanupNotifications(userId)
  }
}

export default {
  check: expressify(check),
}
