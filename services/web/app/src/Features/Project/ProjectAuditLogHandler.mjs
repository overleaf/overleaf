import logger from '@overleaf/logger'
import { ProjectAuditLogEntry } from '../../models/ProjectAuditLogEntry.js'
import { callbackify } from '@overleaf/promise-utils'
import SubscriptionLocator from '../Subscription/SubscriptionLocator.mjs'

const MANAGED_GROUP_PROJECT_EVENTS = [
  'accept-invite',
  'project-created',
  'project-deleted',
  'project-archived',
  'project-unarchived',
  'project-trashed',
  'project-untrashed',
  'project-restored',
  'project-cloned',
]

export default {
  promises: {
    addEntry,
    addEntryIfManaged,
  },
  addEntry: callbackify(addEntry),
  addEntryIfManaged: callbackify(addEntryIfManaged),
  addEntryInBackground,
  addEntryIfManagedInBackground,
  MANAGED_GROUP_PROJECT_EVENTS,
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

  if (MANAGED_GROUP_PROJECT_EVENTS.includes(operation)) {
    const managedSubscription =
      await SubscriptionLocator.promises.getUniqueManagedSubscriptionMemberOf(
        info.userId || initiatorId
      )

    if (managedSubscription) {
      entry.managedSubscriptionId = managedSubscription._id
    }
  }
  await ProjectAuditLogEntry.create(entry)
}

async function addEntryIfManaged(
  projectId,
  operation,
  initiatorId,
  ipAddress,
  info = {}
) {
  if (!MANAGED_GROUP_PROJECT_EVENTS.includes(operation)) {
    return
  }

  const managedSubscription =
    await SubscriptionLocator.promises.getUniqueManagedSubscriptionMemberOf(
      info.userId || initiatorId
    )
  if (!managedSubscription) {
    return
  }

  const entry = {
    projectId,
    operation,
    initiatorId,
    ipAddress,
    info,
    managedSubscriptionId: managedSubscription._id,
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

function addEntryIfManagedInBackground(
  projectId,
  operation,
  initiatorId,
  ipAddress,
  info = {}
) {
  addEntryIfManaged(projectId, operation, initiatorId, ipAddress, info).catch(
    err => {
      logger.error(
        { err, projectId, operation, initiatorId, ipAddress, info },
        'Failed to write audit log'
      )
    }
  )
}
