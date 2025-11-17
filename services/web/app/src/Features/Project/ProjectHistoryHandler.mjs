import { Project } from '../../models/Project.mjs'
import ProjectDetailsHandler from './ProjectDetailsHandler.mjs'
import HistoryManager from '../History/HistoryManager.mjs'
import ProjectEntityUpdateHandler from './ProjectEntityUpdateHandler.mjs'
import { callbackify } from 'node:util'

const ProjectHistoryHandler = {
  async setHistoryId(projectId, historyId) {
    // reject invalid history ids
    if (historyId == null) {
      throw new Error('missing history id')
    }

    // use $exists:false to prevent overwriting any existing history id, atomically
    const result = await Project.updateOne(
      { _id: projectId, 'overleaf.history.id': { $exists: false } },
      { 'overleaf.history.id': historyId }
    )

    if (result.matchedCount === 0) {
      throw new Error('history exists')
    }
  },

  async getHistoryId(projectId) {
    const project = await ProjectDetailsHandler.promises.getDetails(projectId)
    return project?.overleaf?.history?.id
  },

  async ensureHistoryExistsForProject(projectId) {
    // We can only set a history id for a project that doesn't have one. The
    // history id is cached in the project history service, and changing an
    // existing value corrupts the history, leaving it in an irrecoverable
    // state. Setting a history id when one wasn't present before is ok,
    // because undefined history ids aren't cached.
    let historyId = await ProjectHistoryHandler.getHistoryId(projectId)

    if (historyId != null) {
      return
    }

    historyId = await HistoryManager.promises.initializeProject(projectId)
    if (historyId == null) {
      throw new Error('failed to initialize history id')
    }

    await ProjectHistoryHandler.setHistoryId(projectId, historyId)

    await ProjectEntityUpdateHandler.promises.resyncProjectHistory(
      projectId,
      {}
    )

    await HistoryManager.promises.flushProject(projectId)
  },
}

export default {
  setHistoryId: callbackify(ProjectHistoryHandler.setHistoryId),
  getHistoryId: callbackify(ProjectHistoryHandler.getHistoryId),
  ensureHistoryExistsForProject: callbackify(
    ProjectHistoryHandler.ensureHistoryExistsForProject
  ),
  promises: ProjectHistoryHandler,
}
