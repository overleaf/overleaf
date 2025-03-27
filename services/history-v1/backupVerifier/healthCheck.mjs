import config from 'config'
import { verifyProjectWithErrorContext } from '../storage/lib/backupVerifier.mjs'
import {
  measureNeverBackedUpProjects,
  measurePendingChangesBeforeTime,
} from './ProjectMetrics.mjs'
import { getEndDateForRPO, RPO } from './utils.mjs'

/** @type {Array<string>} */
const HEALTH_CHECK_PROJECTS = JSON.parse(config.get('healthCheckProjects'))

export async function healthCheck() {
  if (!Array.isArray(HEALTH_CHECK_PROJECTS)) {
    throw new Error('expected healthCheckProjects to be an array')
  }
  if (HEALTH_CHECK_PROJECTS.length !== 2) {
    throw new Error('expected 2 healthCheckProjects')
  }
  if (!HEALTH_CHECK_PROJECTS.some(id => id.length === 24)) {
    throw new Error('expected mongo id in healthCheckProjects')
  }
  if (!HEALTH_CHECK_PROJECTS.some(id => id.length < 24)) {
    throw new Error('expected postgres id in healthCheckProjects')
  }

  for (const historyId of HEALTH_CHECK_PROJECTS) {
    await verifyProjectWithErrorContext(historyId)
  }

  await measurePendingChangesBeforeTime(getEndDateForRPO(2))
  await measureNeverBackedUpProjects(getEndDateForRPO(2))
}
