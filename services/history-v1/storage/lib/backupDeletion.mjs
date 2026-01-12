// @ts-check
import { callbackify } from 'node:util'
import { ObjectId } from 'mongodb'
import config from 'config'
import OError from '@overleaf/o-error'
import { db } from './mongodb.js'
import projectKey from '@overleaf/object-persistor/src/ProjectKey.js'
import chunkStore from '../lib/chunk_store/index.js'
import {
  backupPersistor,
  chunksBucket,
  projectBlobsBucket,
} from './backupPersistor.mjs'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const EXPIRE_PROJECTS_AFTER_MS =
  parseInt(config.get('minSoftDeletionPeriodDays'), 10) * MS_PER_DAY
const deletedProjectsCollection = db.collection('deletedProjects')

/**
 * @param {string} historyId
 * @return {Promise<boolean>}
 */
async function projectHasLatestChunk(historyId) {
  const chunk = await chunkStore.getBackend(historyId).getLatestChunk(historyId)
  return chunk != null
}

export class NotReadyToDelete extends OError {}

/**
 * @param {string} projectId
 * @return {Promise<void>}
 */
async function deleteProjectBackup(projectId) {
  const deletedProject = await deletedProjectsCollection.findOne(
    { 'deleterData.deletedProjectId': new ObjectId(projectId) },
    {
      projection: {
        'deleterData.deletedProjectOverleafHistoryId': 1,
        'deleterData.deletedAt': 1,
      },
    }
  )
  if (!deletedProject) {
    throw new NotReadyToDelete('refusing to delete non-deleted project')
  }
  const expiresAt =
    deletedProject.deleterData.deletedAt.getTime() + EXPIRE_PROJECTS_AFTER_MS
  if (expiresAt > Date.now()) {
    throw new NotReadyToDelete('refusing to delete non-expired project')
  }

  const historyId =
    deletedProject.deleterData.deletedProjectOverleafHistoryId?.toString()
  if (!historyId) {
    throw new NotReadyToDelete(
      'refusing to delete project with unknown historyId'
    )
  }

  if (await projectHasLatestChunk(historyId)) {
    throw new NotReadyToDelete(
      'refusing to delete project with remaining chunks'
    )
  }

  const prefix = projectKey.format(historyId) + '/'
  await backupPersistor.deleteDirectory(chunksBucket, prefix)
  await backupPersistor.deleteDirectory(projectBlobsBucket, prefix)
}

export async function healthCheck() {
  const HEALTH_CHECK_PROJECTS = JSON.parse(config.get('healthCheckProjects'))
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
    if (!(await projectHasLatestChunk(historyId))) {
      throw new Error(`project has no history: ${historyId}`)
    }
  }
}

export const healthCheckCb = callbackify(healthCheck)
export const deleteProjectBackupCb = callbackify(deleteProjectBackup)
