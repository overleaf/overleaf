const logger = require('@overleaf/logger')
const { ProjectAuditLogEntry } = require('../../models/ProjectAuditLogEntry')
const { callbackify } = require('@overleaf/promise-utils')

module.exports = {
  promises: {
    addEntry,
  },
  addEntry: callbackify(addEntry), // callback version of addEntry
  addEntryInBackground,
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
async function addEntry(
  projectId,
  operation,
  initiatorId,
  ipAddress,
  info = {}
) {
  const entry = {
    projectId,
    operation,
    initiatorId,
    ipAddress,
    info,
  }
  await ProjectAuditLogEntry.create(entry)
}

/**
 * Add an audit log entry in the background
 *
 * This function doesn't return a promise. Instead, it catches any error and logs it.
 */
function addEntryInBackground(
  projectId,
  operation,
  initiatorId,
  ipAddress,
  info = {}
) {
  addEntry(projectId, operation, initiatorId, ipAddress, info).catch(err => {
    logger.error(
      { err, projectId, operation, initiatorId, ipAddress, info },
      'Failed to write audit log'
    )
  })
}
