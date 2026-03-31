import { ObjectId } from './mongodb.js'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import * as LockManager from './LockManager.js'
import { fetchNothing } from '@overleaf/fetch-utils'
import { callbackify } from '@overleaf/promise-utils'

const { port } = settings.internal.history

const checkCb = callbackify(check)
export { checkCb as check }

async function check() {
  const projectId = new ObjectId(settings.history.healthCheck.project_id)
  const url = `http://127.0.0.1:${port}/project/${projectId}`
  logger.debug({ projectId }, 'running health check')
  try {
    await fetchNothing(`http://127.0.0.1:${port}/check_lock`, {
      signal: AbortSignal.timeout(3_000),
    })
  } catch (err) {
    throw OError.tag(err, 'error checking lock for health check', {
      project_id: projectId,
    })
  }

  try {
    await fetchNothing(`${url}/flush`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    throw OError.tag(err, 'error flushing for health check', {
      project_id: projectId,
    })
  }

  try {
    await fetchNothing(`${url}/updates`, {
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    throw OError.tag(err, 'error getting updates for health check', {
      project_id: projectId,
    })
  }
}

export function checkLock(callback) {
  return LockManager.healthCheck(callback)
}
