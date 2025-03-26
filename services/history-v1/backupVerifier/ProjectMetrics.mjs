import Metrics from '@overleaf/metrics'
import { objectIdFromDate } from './utils.mjs'
import { db } from '../storage/lib/mongodb.js'

const projectsCollection = db.collection('projects')

/**
 *
 * @param {Date} beforeTime
 * @return {Promise<void>}
 */
export async function measurePendingChangesBeforeTime(beforeTime) {
  const pendingChangeCount = await projectsCollection.countDocuments({
    'overleaf.backup.pendingChangeAt': {
      $lt: beforeTime,
    },
  })

  Metrics.gauge('backup_verification_pending_changes', pendingChangeCount)
}

/**
 *
 * @param {number} graceSeconds - Number of seconds projects are allowed before they must be backed up.
 * @return {Promise<void>}
 */
export async function measureNeverBackedUpProjects(graceSeconds) {
  const now = new Date()
  const startOfGracePeriod = new Date(now - graceSeconds * 1000)
  const neverBackedUpCount = await projectsCollection.countDocuments({
    'overleaf.backup.lastBackedUpVersion': null,
    _id: { $lt: objectIdFromDate(startOfGracePeriod) },
  })
  Metrics.gauge('backup_verification_never_backed_up', neverBackedUpCount)
}
