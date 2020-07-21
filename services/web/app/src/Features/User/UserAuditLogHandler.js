const OError = require('@overleaf/o-error')
const { User } = require('../../models/User')

const MAX_AUDIT_LOG_ENTRIES = 200

/**
 * Add an audit log entry
 *
 * The entry should include at least the following fields:
 *
 * - operation: a string identifying the type of operation
 * - initiatorId: who performed the operation
 * - info: an object detailing what happened
 * - userId: the user on behalf of whom the operation was performed
 */
async function addEntry(userId, operation, initiatorId, ipAddress, info = {}) {
  const timestamp = new Date()
  const entry = {
    operation,
    initiatorId,
    info,
    ipAddress,
    timestamp
  }
  const result = await User.updateOne(
    { _id: userId },
    {
      $push: {
        auditLog: { $each: [entry], $slice: -MAX_AUDIT_LOG_ENTRIES }
      }
    }
  ).exec()
  if (result.nModified === 0) {
    throw new OError({
      message: 'user not found',
      info: { userId }
    })
  }
}

const UserAuditLogHandler = {
  promises: {
    addEntry
  }
}

module.exports = UserAuditLogHandler
