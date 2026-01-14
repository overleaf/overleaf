import OError from '@overleaf/o-error'
import logger from '@overleaf/logger'
import { UserAuditLogEntry } from '../../models/UserAuditLogEntry.mjs'
import { callbackify } from 'node:util'
import SubscriptionLocator from '../Subscription/SubscriptionLocator.mjs'
import Features from '../../infrastructure/Features.mjs'

function _canHaveNoIpAddressId(operation, info) {
  if (operation === 'add-email' && info.script) return true
  if (operation === 'join-group-subscription') return true
  if (operation === 'leave-group-subscription') return true
  if (operation === 'must-reset-password-set') return true
  if (operation === 'remove-email' && info.script) return true
  if (operation === 'release-managed-user' && info.script) return true
  if (operation === 'unlink-dropbox' && info.batch) return true
  return false
}

function _canHaveNoInitiatorId(operation, info) {
  if (operation === 'add-email' && info.script) return true
  if (operation === 'reset-password') return true
  if (operation === 'unlink-sso' && info.providerId === 'collabratec')
    return true
  if (operation === 'unlink-sso' && info.script === true) return true
  if (operation === 'unlink-institution-sso-not-migrated') return true
  if (operation === 'remove-email' && info.script) return true
  if (operation === 'join-group-subscription') return true
  if (operation === 'leave-group-subscription') return true
  if (operation === 'must-reset-password-set') return true
  if (operation === 'must-reset-password-unset') return true
  if (operation === 'account-suspension' && info.script) return true
  if (operation === 'release-managed-user' && info.script) return true
}

// events that are visible to managed user admins in Group Audit Logs view
const MANAGED_GROUP_USER_EVENTS = [
  'login',
  'logout',
  'reset-password',
  'update-password',
  'link-dropbox',
  'unlink-dropbox',
  'link-github',
  'unlink-github',
  'delete-account',
  'leave-group-subscription',
  'integration-account-linked',
  'integration-account-unlinked',
]

/**
 * Add an audit log entry
 *
 * The entry should include at least the following fields:
 *
 * - userId: the user on behalf of whom the operation was performed
 * - operation: a string identifying the type of operation
 * - initiatorId: who performed the operation
 * - ipAddress: the IP address of the initiator
 * - info: an object detailing what happened
 */
async function addEntry(userId, operation, initiatorId, ipAddress, info = {}) {
  if (!operation) {
    throw new OError('missing operation for audit log', {
      initiatorId,
      ipAddress,
    })
  }

  if (!ipAddress && !_canHaveNoIpAddressId(operation, info)) {
    throw new OError('missing ipAddress for audit log', {
      operation,
      initiatorId,
    })
  }

  if (!initiatorId && !_canHaveNoInitiatorId(operation, info)) {
    throw new OError('missing initiatorId for audit log', {
      operation,
      ipAddress,
    })
  }

  const entry = {
    userId,
    operation,
    initiatorId,
    info,
    ipAddress,
  }

  if (
    MANAGED_GROUP_USER_EVENTS.includes(operation) &&
    Features.hasFeature('saas')
  ) {
    try {
      const managedSubscription =
        await SubscriptionLocator.promises.getUniqueManagedSubscriptionMemberOf(
          userId
        )
      if (managedSubscription) {
        entry.managedSubscriptionId = managedSubscription._id
      }
    } catch (err) {
      logger.error({ err, userId }, 'failed to lookup managed subscription')
    }
  }

  await UserAuditLogEntry.create(entry)
}

function addEntryInBackground(
  userId,
  operation,
  initiatorId,
  ipAddress,
  info = {}
) {
  // Intentionally not awaited
  addEntry(userId, operation, initiatorId, ipAddress, info).catch(err => {
    logger.error(
      { err, userId, operation, initiatorId, ipAddress, info },
      'error adding user audit log entry'
    )
  })
}

const UserAuditLogHandler = {
  MANAGED_GROUP_USER_EVENTS,
  addEntry: callbackify(addEntry),
  promises: {
    addEntry,
  },
  addEntryInBackground,
}

export default UserAuditLogHandler
