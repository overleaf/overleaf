import logger from '@overleaf/logger'
import { ProjectAuditLogEntry } from '../../models/ProjectAuditLogEntry.mjs'
import { callbackify } from '@overleaf/promise-utils'
import SubscriptionLocator from '../Subscription/SubscriptionLocator.mjs'
import _ from 'lodash'

const MANAGED_GROUP_PROJECT_EVENTS = [
  'send-invite',
  'accept-invite',
  'project-created',
  'project-deleted',
  'project-archived',
  'project-unarchived',
  'project-trashed',
  'project-untrashed',
  'project-restored',
  'project-cloned',
  'project-history-version-restored',
  'project-history-version-downloaded',
  'transfer-ownership',
  'project-downloaded',
]

async function findManagedSubscriptions(entry) {
  if (!MANAGED_GROUP_PROJECT_EVENTS.includes(entry.operation)) {
    return
  }

  // remove duplications and empty values
  const userIds = _.uniq(
    _.compact([
      entry.info?.previousOwnerId,
      entry.info?.newOwnerId,
      entry.initiatorId,
    ])
  )

  const managedSubscriptions = await Promise.all(
    userIds.map(id =>
      SubscriptionLocator.promises.getUniqueManagedSubscriptionMemberOf(id)
    )
  )
  const ids = managedSubscriptions.map(subscription =>
    subscription?._id.toString()
  )

  return _.uniq(_.compact(ids))
}

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
 * Add an audit log entry. If the entry involves multiple managed subscriptions,
 * adds multiple entries each with a different managedSubscriptionId.
 *
 * The entry should include at least the following fields:
 *
 * @param {ObjectId} projectId - the project for which the operation was performed
 * @param {string} operation - a string identifying the type of operation
 * @param {ObjectId} initiatorId - the user on behalf of whom the operation was performed
 * @param {string} ipAddress - the IP address of the initiator
 * @param {object} info - any additional payload
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
  const managedSubscriptions = await findManagedSubscriptions(entry)
  if (managedSubscriptions?.length) {
    for (const managedSubscriptionId of managedSubscriptions) {
      await ProjectAuditLogEntry.create({
        ...entry,
        managedSubscriptionId,
      })
    }
  } else {
    await ProjectAuditLogEntry.create(entry)
  }
}

/**
 * Add an audit log entry only if the entry is related to a managed subscription.
 * If the entry involves multiple managed subscriptions, adds multiple entries each
 * with a different managedSubscriptionId.
 *
 * The entry should include at least the following fields:
 *
 * @param {ObjectId} projectId - the project for which the operation was performed
 * @param {string} operation - a string identifying the type of operation
 * @param {ObjectId} initiatorId - the user on behalf of whom the operation was performed
 * @param {string} ipAddress - the IP address of the initiator
 * @param {object} info - any additional payload
 */
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

  const entry = {
    projectId,
    operation,
    initiatorId,
    ipAddress,
    info,
  }

  const managedSubscriptions = await findManagedSubscriptions(entry)
  if (!managedSubscriptions?.length) {
    return
  }

  for (const managedSubscriptionId of managedSubscriptions) {
    await ProjectAuditLogEntry.create({
      ...entry,
      managedSubscriptionId,
    })
  }
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

/**
 * Add an audit log entry in the background only if related to a managed subscription.
 */
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
