import { Project } from '../../models/Project.mjs'
import { callbackify } from 'node:util'

const ProjectUpdateHandler = {
  async markAsUpdated(projectId, lastUpdatedAt, lastUpdatedBy) {
    if (!lastUpdatedAt) {
      lastUpdatedAt = new Date()
    }

    const conditions = {
      _id: projectId,
      lastUpdated: { $lt: lastUpdatedAt },
    }

    const update = {
      lastUpdated: lastUpdatedAt || new Date().getTime(),
      lastUpdatedBy,
    }
    await Project.updateOne(conditions, update, {}).exec()
  },

  async markAsOpened(projectId) {
    const conditions = { _id: projectId }
    const update = { lastOpened: Date.now() }
    await Project.updateOne(conditions, update, {}).exec()
  },

  async markAsInactive(projectId) {
    const conditions = { _id: projectId }
    const update = { active: false }
    await Project.updateOne(conditions, update, {}).exec()
  },

  async markAsActive(projectId) {
    const conditions = { _id: projectId }
    const update = { active: true }
    await Project.updateOne(conditions, update, {}).exec()
  },
}

export default {
  markAsUpdated: callbackify(ProjectUpdateHandler.markAsUpdated),
  markAsOpened: callbackify(ProjectUpdateHandler.markAsOpened),
  markAsInactive: callbackify(ProjectUpdateHandler.markAsInactive),
  markAsActive: callbackify(ProjectUpdateHandler.markAsActive),
  promises: ProjectUpdateHandler,
}
