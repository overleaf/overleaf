import path from 'node:path'
import settings from '@overleaf/settings'
import {
  fetchJson,
  fetchNothing,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import logger from '@overleaf/logger'
import _ from 'lodash'
import { callbackifyAll } from '@overleaf/promise-utils'
import OError from '@overleaf/o-error'

const notificationsApi = _.get(settings, ['apis', 'notifications', 'url'])
const oneSecond = 1000

async function getUserNotifications(userId) {
  if (!notificationsApi) return []

  const url = new URL(notificationsApi)
  url.pathname = path.posix.join('user', userId.toString())

  try {
    const body = await fetchJson(url, {
      signal: AbortSignal.timeout(oneSecond),
    })
    return body || []
  } catch (err) {
    logger.err({ err, userId }, 'something went wrong getting notifications')
    return []
  }
}

async function createNotification(
  userId,
  key,
  templateKey,
  messageOpts,
  expiryDateTime,
  forceCreate = true
) {
  if (!notificationsApi) return

  const payload = {
    key,
    messageOpts,
    templateKey,
    forceCreate,
  }
  if (expiryDateTime) {
    payload.expires = expiryDateTime
  }
  const url = new URL(notificationsApi)
  url.pathname = path.posix.join('user', userId.toString())
  try {
    return await fetchNothing(url, {
      method: 'POST',
      json: payload,
      signal: AbortSignal.timeout(oneSecond),
    })
  } catch (err) {
    // keep the behavior from `request`
    if (!(err instanceof RequestFailedError)) {
      throw OError.tag(err, 'Failed create notification')
    }
  }
}

async function markAsReadWithKey(userId, key) {
  if (!notificationsApi) return

  const url = new URL(notificationsApi)
  url.pathname = path.posix.join('user', userId.toString())
  try {
    await fetchNothing(url, {
      method: 'DELETE',
      json: { key },
      signal: AbortSignal.timeout(oneSecond),
    })
  } catch (err) {
    // keep the behavior from `request`
    if (!(err instanceof RequestFailedError)) {
      throw OError.tag(err, 'markAsReadWithKey failed')
    }
  }
}

async function markAsRead(userId, notificationId) {
  if (!notificationsApi) return

  const url = new URL(notificationsApi)
  url.pathname = path.posix.join(
    'user',
    userId.toString(),
    'notification',
    notificationId
  )
  try {
    await fetchNothing(url, {
      method: 'DELETE',
      signal: AbortSignal.timeout(oneSecond),
    })
  } catch (err) {
    // keep the behavior from `request`
    if (!(err instanceof RequestFailedError)) {
      throw OError.tag(err, 'markAsRead failed')
    }
  }
}

// removes notification by key, without regard for user_id,
// should not be exposed to user via ui/router
async function markAsReadByKeyOnly(key) {
  if (!notificationsApi) return

  const url = new URL(notificationsApi)
  url.pathname = path.posix.join('key', key)
  try {
    await fetchNothing(url, {
      method: 'DELETE',
      signal: AbortSignal.timeout(oneSecond),
    })
  } catch (err) {
    // keep the behavior from `request`
    if (!(err instanceof RequestFailedError)) {
      throw OError.tag(err, 'markAsReadByKeyOnly failed')
    }
  }
}

async function previewMarkAsReadByKeyOnlyBulk(key) {
  if (!notificationsApi) return 0

  const url = new URL(notificationsApi)
  url.pathname = path.posix.join('key', key, 'count')
  const body = await fetchJson(url, {
    signal: AbortSignal.timeout(10 * oneSecond),
  })
  return body?.count || 0
}

async function markAsReadByKeyOnlyBulk(key) {
  if (!notificationsApi) return 0

  const url = new URL(notificationsApi)
  url.pathname = path.posix.join('key', key, 'bulk')
  const body = await fetchJson(url, {
    method: 'DELETE',
    signal: AbortSignal.timeout(10 * oneSecond),
  })
  return body?.count || 0
}

const promises = {
  getUserNotifications,
  createNotification,
  markAsReadWithKey,
  markAsRead,
  markAsReadByKeyOnly,
  previewMarkAsReadByKeyOnlyBulk,
  markAsReadByKeyOnlyBulk,
}

const NotificationsHandler = {
  ...callbackifyAll(promises),
  promises,
}

export default NotificationsHandler
