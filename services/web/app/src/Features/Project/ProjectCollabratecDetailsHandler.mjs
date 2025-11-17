import mongodb from 'mongodb-legacy'

import { Project } from '../../models/Project.mjs'
import { callbackifyAll } from '@overleaf/promise-utils'

const { ObjectId } = mongodb

const ProjectCollabratecDetailsHandler = {
  async initializeCollabratecProject(
    projectId,
    userId,
    collabratecDocumentId,
    collabratecPrivategroupId
  ) {
    return await ProjectCollabratecDetailsHandler.setCollabratecUsers(
      projectId,
      [
        {
          user_id: userId,
          collabratec_document_id: collabratecDocumentId,
          collabratec_privategroup_id: collabratecPrivategroupId,
        },
      ]
    )
  },

  async isLinkedCollabratecUserProject(projectId, userId) {
    projectId = new ObjectId(projectId)
    userId = new ObjectId(userId)

    const query = {
      _id: projectId,
      collabratecUsers: {
        $elemMatch: {
          user_id: userId,
        },
      },
    }
    const project = await Project.findOne(query, { _id: 1 }).exec()
    return project != null
  },

  async linkCollabratecUserProject(projectId, userId, collabratecDocumentId) {
    projectId = new ObjectId(projectId)
    userId = new ObjectId(userId)

    const query = {
      _id: projectId,
      collabratecUsers: {
        $not: {
          $elemMatch: {
            collabratec_document_id: collabratecDocumentId,
            user_id: userId,
          },
        },
      },
    }
    const update = {
      $push: {
        collabratecUsers: {
          collabratec_document_id: collabratecDocumentId,
          user_id: userId,
        },
      },
    }
    return await Project.updateOne(query, update).exec()
  },

  async setCollabratecUsers(projectId, collabratecUsers) {
    projectId = new ObjectId(projectId)

    if (!Array.isArray(collabratecUsers)) {
      throw new Error('collabratec_users must be array')
    }

    for (const collabratecUser of collabratecUsers) {
      collabratecUser.user_id = new ObjectId(collabratecUser.user_id)
    }

    const update = { $set: { collabratecUsers } }
    return await Project.updateOne({ _id: projectId }, update).exec()
  },

  async unlinkCollabratecUserProject(projectId, userId) {
    projectId = new ObjectId(projectId)
    userId = new ObjectId(userId)

    const query = { _id: projectId }
    const update = {
      $pull: {
        collabratecUsers: {
          user_id: userId,
        },
      },
    }
    await Project.updateOne(query, update).exec()
  },
}

export default {
  ...callbackifyAll(ProjectCollabratecDetailsHandler),
  promises: ProjectCollabratecDetailsHandler,
}
