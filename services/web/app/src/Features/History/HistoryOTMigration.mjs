import ProjectGetter from '../Project/ProjectGetter.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import HistoryManager from '../History/HistoryManager.mjs'
import * as RealTimeHandler from '../References/RealTime/RealTimeHandler.mjs'
import ProjectOptionsHandler from '../Project/ProjectOptionsHandler.mjs'
import {
  NotFoundError,
  FoundConnectedClientsError,
  ConcurrentLoadingOfDocsDetectedError,
} from '../Errors/Errors.js'

async function ensureNoConnectedClients(projectId) {
  const n = await RealTimeHandler.countConnectedClients(projectId)
  if (n > 0) throw new FoundConnectedClientsError(n)
}

/**
 * @param {string} projectId
 * @param {number} nextStage
 * @return {Promise<{otMigrationStage: number}>}
 */
export async function advanceOTMigrationStage(projectId, nextStage) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    overleaf: true,
  })
  if (!project) throw new NotFoundError()
  const { otMigrationStage } = project?.overleaf?.history || {}
  if (otMigrationStage >= nextStage) return { otMigrationStage }

  // NOTE: For the single connected client case, we could emit a pub/sub event here asking any (inactive) client without pending edits to disconnect briefly.
  // e.g. EditorRealTimeController.emitToRoom(projectId, 'attempt-history-ot-migration')

  // Ensure we can perform the hard migration
  await ensureNoConnectedClients(projectId)

  // Flush ahead of migrating to keep the time under lock down.
  await DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete(projectId)
  // Avoid mixing update types
  await HistoryManager.promises.flushProject(projectId)

  // Obtain lock
  if (!(await DocumentUpdaterHandler.promises.blockProject(projectId))) {
    throw new ConcurrentLoadingOfDocsDetectedError()
  }

  try {
    // Perform the mongo update and tell caller about the latest stage.
    return await ProjectOptionsHandler.promises.setOTMigrationStage(
      projectId,
      nextStage
    )
  } finally {
    // Unlock again (The lock will expire after 30s otherwise)
    await DocumentUpdaterHandler.promises.unblockProject(projectId)
  }
}
