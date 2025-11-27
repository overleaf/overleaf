import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import { db } from '../../infrastructure/mongodb.mjs'
import Mongo from '../Helpers/Mongo.mjs'
import { callbackify } from 'node:util'
import UserGetter from './UserGetter.mjs'
import InstitutionsAPI from '../Institutions/InstitutionsAPI.mjs'
import Features from '../../infrastructure/Features.mjs'
import FeaturesUpdater from '../Subscription/FeaturesUpdater.mjs'
import EmailHandler from '../Email/EmailHandler.mjs'
import EmailHelper from '../Helpers/EmailHelper.mjs'
import Errors from '../Errors/Errors.js'
import NewsletterManager from '../Newsletter/NewsletterManager.mjs'
import UserAuditLogHandler from './UserAuditLogHandler.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import EmailChangeHelper from '../Analytics/EmailChangeHelper.mjs'
import SubscriptionLocator from '../Subscription/SubscriptionLocator.mjs'
import NotificationsBuilder from '../Notifications/NotificationsBuilder.mjs'
import _ from 'lodash'
import Modules from '../../infrastructure/Modules.mjs'
import UserSessionsManager from './UserSessionsManager.mjs'
import ThirdPartyIdentityManager from './ThirdPartyIdentityManager.mjs'
import AsyncLocalStorage from '../../infrastructure/AsyncLocalStorage.mjs'

const { normalizeQuery } = Mongo

async function _sendSecurityAlertPrimaryEmailChanged(
  userId,
  oldEmail,
  email,
  deleteOldEmail
) {
  // here
  // Send email to the following:
  // - the old primary
  // - the new primary
  // - for all other current (confirmed or recently-enough reconfirmed) email addresses, group by institution if we
  //   have it, or domain if we don’t, and for each group send to the most recently reconfirmed (or confirmed if never
  //   reconfirmed) address in that group.
  // See #6101.
  const emailOptions = {
    actionDescribed: `the primary email address on your account was changed to ${email}`,
    action: 'change of primary email address',
    message: deleteOldEmail
      ? [
          `We also removed the previous primary email ${oldEmail} from the account.`,
        ]
      : [],
  }

  async function sendToRecipients(recipients) {
    // On failure, log the error and carry on so that one email failing does not prevent other emails sending
    for await (const recipient of recipients) {
      try {
        const opts = Object.assign({}, emailOptions, { to: recipient })
        await EmailHandler.promises.sendEmail('securityAlert', opts)
      } catch (error) {
        logger.error(
          { error, userId },
          'could not send security alert email when primary email changed'
        )
      }
    }
  }

  // First, send notification to the old and new primary emails before getting other emails from v1 to ensure that these
  // are still sent in the event of not being able to reach v1
  const oldAndNewPrimaryEmails = [oldEmail, email]
  await sendToRecipients(oldAndNewPrimaryEmails)

  // Next, get extra recipients with affiliation data
  const emailsData = await UserGetter.promises.getUserFullEmails(userId)
  const extraRecipients = _securityAlertPrimaryEmailChangedExtraRecipients(
    emailsData,
    oldEmail,
    email
  )

  await sendToRecipients(extraRecipients)
}

/**
 * Add a new email address for the user. Email cannot be already used by this
 * or any other user
 */
async function addEmailAddress(userId, newEmail, affiliationOptions, auditLog) {
  AsyncLocalStorage.removeItem('userFullEmails')
  newEmail = EmailHelper.parseEmail(newEmail)
  if (!newEmail) {
    throw new Error('invalid email')
  }

  await UserGetter.promises.ensureUniqueEmailAddress(newEmail)

  AnalyticsManager.recordEventForUserInBackground(
    userId,
    'secondary-email-added'
  )

  await UserAuditLogHandler.promises.addEntry(
    userId,
    'add-email',
    auditLog.initiatorId,
    auditLog.ipAddress,
    {
      ...auditLog.info,
      newSecondaryEmail: newEmail,
    }
  )

  try {
    await InstitutionsAPI.promises.addAffiliation(
      userId,
      newEmail,
      affiliationOptions
    )
  } catch (error) {
    throw OError.tag(error, 'problem adding affiliation while adding email')
  }

  const createdAt = new Date()
  let res
  try {
    const reversedHostname = newEmail.split('@')[1].split('').reverse().join('')
    const update = {
      $push: {
        emails: { email: newEmail, createdAt, reversedHostname },
      },
    }
    res = await updateUser(
      { _id: userId, 'emails.email': { $ne: newEmail } },
      update
    )
  } catch (error) {
    throw OError.tag(error, 'problem updating users emails')
  }

  if (res.matchedCount !== 1) {
    return
  }

  try {
    await EmailChangeHelper.registerEmailCreation(userId, newEmail, {
      createdAt: new Date(),
      emailCreatedAt: createdAt,
    })
  } catch (error) {
    logger.warn(
      { error, userId, newEmail },
      'Error registering email creation with analytics'
    )
  }
}

async function clearSAMLData(userId, auditLog, sendEmail) {
  const user = await UserGetter.promises.getUser(userId, {
    email: 1,
    emails: 1,
  })

  await UserAuditLogHandler.promises.addEntry(
    userId,
    'clear-institution-sso-data',
    auditLog.initiatorId,
    auditLog.ipAddress,
    {}
  )

  const update = {
    $unset: {
      samlIdentifiers: 1,
      'emails.$[].samlProviderId': 1,
      'enrollment.sso': 1,
    },
  }

  await updateUser(userId, update)

  for (const emailData of user.emails) {
    await InstitutionsAPI.promises.removeEntitlement(userId, emailData.email)
  }

  await FeaturesUpdater.promises.refreshFeatures(
    userId,
    'clear-institution-sso-data'
  )

  if (sendEmail) {
    await EmailHandler.promises.sendEmail('SAMLDataCleared', { to: user.email })
  }
}

async function clearThirdPartyIdentifiers(userId, auditLog) {
  const user = await UserGetter.promises.getUser(userId, {
    thirdPartyIdentifiers: 1,
  })
  await UserAuditLogHandler.promises.addEntry(
    userId,
    'clear-third-party-identifiers',
    auditLog.initiatorId,
    auditLog.ipAddress,
    {}
  )
  for (const thirdPartyIdentifier of user.thirdPartyIdentifiers || []) {
    await ThirdPartyIdentityManager.promises.unlink(
      userId,
      thirdPartyIdentifier.providerId,
      auditLog
    )
  }
}

/**
 * set the default email address by setting the `email` attribute. The email
 * must be one of the user's multiple emails (`emails` attribute)
 */
async function setDefaultEmailAddress(
  userId,
  email,
  allowUnconfirmed,
  auditLog,
  sendSecurityAlert,
  deleteOldEmail = false
) {
  AsyncLocalStorage.removeItem('userFullEmails')
  email = EmailHelper.parseEmail(email)
  if (email == null) {
    throw new Error('invalid email')
  }

  const user = await UserGetter.promises.getUser(userId, {
    email: 1,
    emails: 1,
  })
  if (!user) {
    throw new Error('invalid userId')
  }

  const oldEmail = user.email
  const userEmail = user.emails.find(e => e.email === email)
  if (!userEmail) {
    throw new Error('Default email does not belong to user')
  }
  if (!userEmail.confirmedAt && !allowUnconfirmed) {
    throw new Errors.UnconfirmedEmailError()
  }

  await UserAuditLogHandler.promises.addEntry(
    userId,
    'change-primary-email',
    auditLog.initiatorId,
    auditLog.ipAddress,
    {
      newPrimaryEmail: email,
      oldPrimaryEmail: oldEmail,
    }
  )

  const query = { _id: userId, 'emails.email': email }
  const update = { $set: { email, lastPrimaryEmailCheck: new Date() } }
  const res = await updateUser(query, update)

  // this should not happen
  if (res.matchedCount !== 1) {
    throw new Error('email update error')
  }

  AnalyticsManager.recordEventForUserInBackground(
    userId,
    'primary-email-address-updated'
  )

  try {
    await EmailChangeHelper.registerEmailUpdate(userId, email, {
      isPrimary: true,
      action: 'updated',
      createdAt: new Date(),
    })
  } catch (err) {
    logger.warn(
      { err, userId, email },
      'Error registering email change with analytics'
    )
  }

  if (sendSecurityAlert) {
    // no need to wait, errors are logged and not passed back
    _sendSecurityAlertPrimaryEmailChanged(
      userId,
      oldEmail,
      email,
      deleteOldEmail
    ).catch(err => {
      logger.error({ err }, 'failed to send security alert email')
    })
  }

  try {
    await NewsletterManager.promises.changeEmail(user, email)
  } catch (error) {
    logger.warn(
      { err: error, oldEmail, newEmail: email },
      'Failed to change email in newsletter subscription'
    )
  }
  try {
    await Modules.promises.hooks.fire('userEmailChanged', user, email)
  } catch (err) {
    logger.error(
      { err, oldEmail, newEmail: email },
      'Failed to fire "userEmailChanged" hook'
    )
  }

  try {
    await Modules.promises.hooks.fire(
      'updateAccountEmailAddress',
      user._id,
      email
    )
  } catch (error) {
    // errors are ignored
  }
}

/**
 * Overwrites the primary email address of a user in the database in-place.
 * This function is only intended for use in scripts to migrate email addresses
 * where we do not want to trigger all the actions that happen when a user
 * changes their own email.  It should not be used in any other circumstances.
 */
async function migrateDefaultEmailAddress(
  userId,
  oldEmail,
  newEmail,
  auditLog
) {
  oldEmail = EmailHelper.parseEmail(oldEmail)
  if (oldEmail == null) {
    throw new Error('invalid old email')
  }
  newEmail = EmailHelper.parseEmail(newEmail)
  if (newEmail == null) {
    throw new Error('invalid new email')
  }
  const reversedHostname = newEmail.split('@')[1].split('').reverse().join('')
  const query = {
    _id: userId,
    email: oldEmail,
    'emails.email': oldEmail,
  }
  const update = {
    $set: {
      email: newEmail,
      'emails.$.email': newEmail,
      'emails.$.reversedHostname': reversedHostname,
    },
  }
  const result = await updateUser(query, update)
  if (result.modifiedCount !== 1) {
    throw new Error('email update error')
  }
  // add a user audit log entry for the email change
  await UserAuditLogHandler.promises.addEntry(
    userId,
    'migrate-default-email',
    auditLog.initiatorId,
    auditLog.ipAddress,
    {
      oldEmail,
      newEmail,
      // Add optional extra info
      ...(auditLog.extraInfo || {}),
    }
  )
}

async function confirmEmail(userId, email, affiliationOptions) {
  AsyncLocalStorage.removeItem('userFullEmails')
  // used for initial email confirmation (non-SSO and SSO)
  // also used for reconfirmation of non-SSO emails
  const confirmedAt = new Date()
  email = EmailHelper.parseEmail(email)
  if (email == null) {
    throw new Error('invalid email')
  }
  logger.debug({ userId, email }, 'confirming user email')

  try {
    affiliationOptions = affiliationOptions || {}
    affiliationOptions.confirmedAt = confirmedAt
    await InstitutionsAPI.promises.addAffiliation(
      userId,
      email,
      affiliationOptions
    )
  } catch (error) {
    throw OError.tag(error, 'problem adding affiliation while confirming email')
  }

  const query = {
    _id: userId,
    'emails.email': email,
  }

  // only update confirmedAt if it was not previously set
  const update = {
    $set: {
      'emails.$.reconfirmedAt': confirmedAt,
    },
    $min: {
      'emails.$.confirmedAt': confirmedAt,
    },
  }

  if (Features.hasFeature('affiliations')) {
    update.$unset = {
      'emails.$.affiliationUnchecked': 1,
    }
  }

  const res = await updateUser(query, update)

  if (res.matchedCount !== 1) {
    throw new Errors.NotFoundError('user id and email do no match')
  }
  await FeaturesUpdater.promises.refreshFeatures(userId, 'confirm-email')

  try {
    await EmailChangeHelper.registerEmailUpdate(userId, email, {
      emailConfirmedAt: confirmedAt,
      action: 'updated',
      isPrimary: false,
    })
  } catch (error) {
    logger.warn(
      { error, userId, email },
      'Error registering email confirmation with analytics'
    )
  }

  try {
    await maybeCreateRedundantSubscriptionNotification(userId, email)
  } catch (error) {
    logger.err(
      { err: error },
      'error checking redundant subscription on email confirmation'
    )
  }
}

async function maybeCreateRedundantSubscriptionNotification(userId, email) {
  const subscription =
    await SubscriptionLocator.promises.getUserIndividualSubscription(userId)
  if (!subscription || subscription.groupPlan) {
    return
  }

  const affiliations =
    await InstitutionsAPI.promises.getUserAffiliations(userId)
  const confirmedAffiliation = affiliations.find(a => a.email === email)
  if (!confirmedAffiliation || confirmedAffiliation.licence === 'free') {
    return
  }

  await NotificationsBuilder.promises
    .redundantPersonalSubscription(
      {
        institutionId: confirmedAffiliation.institution.id,
        institutionName: confirmedAffiliation.institution.name,
      },
      { _id: userId }
    )
    .create()
}

async function removeEmailAddress(
  userId,
  email,
  auditLog,
  skipParseEmail = false
) {
  AsyncLocalStorage.removeItem('userFullEmails')
  // remove one of the user's email addresses. The email cannot be the user's
  // default email address
  if (!skipParseEmail) {
    email = EmailHelper.parseEmail(email)
  } else if (skipParseEmail && typeof email !== 'string') {
    throw new Error('email must be a string')
  }

  if (!email) {
    throw new Error('invalid email')
  }

  const isMainEmail = await UserGetter.promises.getUserByMainEmail(email, {
    _id: 1,
  })
  if (isMainEmail) {
    throw new Error('cannot remove primary email')
  }

  await UserAuditLogHandler.promises.addEntry(
    userId,
    'remove-email',
    auditLog.initiatorId,
    auditLog.ipAddress,
    {
      removedEmail: email,
      // Add optional extra info
      ...(auditLog.extraInfo || {}),
    }
  )

  try {
    await InstitutionsAPI.promises.removeAffiliation(userId, email)
  } catch (error) {
    OError.tag(error, 'problem removing affiliation')
    throw error
  }

  const query = { _id: userId, email: { $ne: email } }
  const update = { $pull: { emails: { email } } }

  let res
  try {
    res = await updateUser(query, update)
  } catch (error) {
    OError.tag(error, 'problem removing users email')
    throw error
  }

  if (res.matchedCount !== 1) {
    throw new Error('Cannot remove email')
  }

  try {
    await EmailChangeHelper.registerEmailDeletion(userId, email, {
      isPrimary: false,
      emailDeletedAt: new Date(),
    })
  } catch (error) {
    logger.warn(
      { error, userId, email },
      'Error registering email deletion with analytics'
    )
  }

  await FeaturesUpdater.promises.refreshFeatures(userId, 'remove-email')
}

async function addAffiliationForNewUser(
  userId,
  email,
  affiliationOptions = {}
) {
  AsyncLocalStorage.removeItem('userFullEmails')
  await InstitutionsAPI.promises.addAffiliation(
    userId,
    email,
    affiliationOptions
  )
  try {
    await updateUser(
      { _id: userId, 'emails.email': email },
      { $unset: { 'emails.$.affiliationUnchecked': 1 } }
    )
  } catch (error) {
    logger.error(
      OError.tag(
        error,
        'could not remove affiliationUnchecked flag for user on create',
        {
          userId,
          email,
        }
      )
    )
  }
}

async function updateUser(query, update) {
  query = normalizeQuery(query)
  const result = await db.users.updateOne(query, update)
  return result
}

/**
 * DEPRECATED
 *
 * Change the user's main email address by adding a new email, switching the
 * default email and removing the old email.  Prefer manipulating multiple
 * emails and the default rather than calling this method directly
 */
async function changeEmailAddress(userId, newEmail, auditLog) {
  newEmail = EmailHelper.parseEmail(newEmail)
  if (newEmail == null) {
    throw new Error('invalid email')
  }

  const oldEmail = await UserGetter.promises.getUserEmail(userId)
  await addEmailAddress(userId, newEmail, {}, auditLog)
  await setDefaultEmailAddress(userId, newEmail, true, auditLog, true)
  await removeEmailAddress(userId, oldEmail, auditLog)
}

/**
 * @param {string} userId
 * @param {{initiatorId: string, ip: string}} auditLog
 * @returns {Promise<void>}
 */
async function removeReconfirmFlag(userId, auditLog) {
  await UserAuditLogHandler.promises.addEntry(
    userId.toString(),
    'must-reset-password-unset',
    auditLog.initiatorId,
    auditLog.ip
  )
  await updateUser(userId.toString(), { $set: { must_reconfirm: false } })
}

async function suspendUser(userId, auditLog = {}) {
  const res = await updateUser(
    { _id: userId, suspended: { $ne: true } },
    { $set: { suspended: true } }
  )
  if (res.matchedCount !== 1) {
    throw new Errors.NotFoundError('user id not found or already suspended')
  }
  await UserAuditLogHandler.promises.addEntry(
    userId,
    'account-suspension',
    auditLog.initiatorId,
    auditLog.ip,
    auditLog.info || {}
  )
  await UserSessionsManager.promises.removeSessionsFromRedis({ _id: userId })
  await Modules.promises.hooks.fire(
    'removeDropbox',
    userId,
    'account-suspension'
  )
}

function _securityAlertPrimaryEmailChangedExtraRecipients(
  emailsData,
  oldEmail,
  email
) {
  // Group by institution if we have it, or domain if we don’t, and for each group send to the most recently
  // reconfirmed (or confirmed if never reconfirmed) address in that group. We also remove the original and new
  // primary email addresses because they are emailed separately
  // See #6101.
  function sortEmailsByConfirmation(emails) {
    return emails.sort((e1, e2) => e2.lastConfirmedAt - e1.lastConfirmedAt)
  }

  const recipients = new Set()
  const emailsToIgnore = new Set([oldEmail, email])

  // Remove non-confirmed emails
  const confirmedEmails = emailsData.filter(email => !!email.lastConfirmedAt)

  // Group other emails by institution, separating out those with no institution and grouping them instead by domain.
  // The keys for each group are not used for anything other than the grouping, so can have a slightly paranoid format
  // to avoid any potential clash
  const groupedEmails = _.groupBy(confirmedEmails, emailData => {
    if (!emailData.affiliation || !emailData.affiliation.institution) {
      return `domain:${EmailHelper.getDomain(emailData.email)}`
    }
    return `institution_id:${emailData.affiliation.institution.id}`
  })

  // For each group of emails, order the emails by (re-)confirmation date and pick the first
  for (const emails of Object.values(groupedEmails)) {
    // Sort by confirmation and pick the first
    sortEmailsByConfirmation(emails)

    // Ignore original and new primary email addresses
    const recipient = emails[0].email
    if (!emailsToIgnore.has(recipient)) {
      recipients.add(emails[0].email)
    }
  }

  return Array.from(recipients)
}

export default {
  addAffiliationForNewUser: callbackify(addAffiliationForNewUser),
  addEmailAddress: callbackify(addEmailAddress),
  changeEmailAddress: callbackify(changeEmailAddress),
  clearSAMLData: callbackify(clearSAMLData),
  confirmEmail: callbackify(confirmEmail),
  removeEmailAddress: callbackify(removeEmailAddress),
  removeReconfirmFlag: callbackify(removeReconfirmFlag),
  setDefaultEmailAddress: callbackify(setDefaultEmailAddress),
  migrateDefaultEmailAddress: callbackify(migrateDefaultEmailAddress),
  updateUser: callbackify(updateUser),
  suspendUser: callbackify(suspendUser),
  promises: {
    addAffiliationForNewUser,
    addEmailAddress,
    changeEmailAddress,
    clearSAMLData,
    clearThirdPartyIdentifiers,
    confirmEmail,
    removeEmailAddress,
    removeReconfirmFlag,
    setDefaultEmailAddress,
    migrateDefaultEmailAddress,
    updateUser,
    suspendUser,
  },
}
