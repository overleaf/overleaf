const OError = require('@overleaf/o-error')
const { Project } = require('../../models/Project')

const MAX_AUDIT_LOG_ENTRIES = 200

module.exports = {
  promises: {
    addEntry
  }
}

/**
 * Add an audit log entry
 *
 * The entry should include at least the following fields:
 *
 * - operation: a string identifying the type of operation
 * - userId: the user on behalf of whom the operation was performed
 * - message: a string detailing what happened
 */
async function addEntry(projectId, operation, initiatorId, info = {}) {
  const timestamp = new Date()
  const entry = {
    operation,
    initiatorId,
    timestamp,
    info
  }
  const result = await Project.updateOne(
    { _id: projectId },
    {
      $push: {
        auditLog: { $each: [entry], $slice: -MAX_AUDIT_LOG_ENTRIES }
      }
    }
  ).exec()
  if (result.nModified === 0) {
    throw new OError({
      message: 'project not found',
      info: { projectId }
    })
  }
}
