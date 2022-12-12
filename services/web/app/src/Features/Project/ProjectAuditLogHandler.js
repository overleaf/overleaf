const { ProjectAuditLogEntry } = require('../../models/ProjectAuditLogEntry')
const { callbackify } = require('../../util/promises')

module.exports = {
  promises: {
    addEntry,
  },
  addEntry: callbackify(addEntry), // callback version of adEntry
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
  const entry = {
    projectId,
    operation,
    initiatorId,
    info,
  }
  await ProjectAuditLogEntry.create(entry)
}
