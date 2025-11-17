import UserAuditLogHandler from '../../../../app/src/Features/User/UserAuditLogHandler.mjs'
import EmailHandler from '../../../../app/src/Features/Email/EmailHandler.mjs'
import EmailOptionsHelper from '../../../../app/src/Features/Email/EmailOptionsHelper.mjs'
import Errors from '../Errors/Errors.js'
import _ from 'lodash'
import logger from '@overleaf/logger'
import settings from '@overleaf/settings'
import { User } from '../../../../app/src/models/User.mjs'
import { callbackify } from '@overleaf/promise-utils'
import OError from '@overleaf/o-error'

const oauthProviders = settings.oauthProviders || {}

async function getUser(providerId, externalUserId) {
  if (providerId == null || externalUserId == null) {
    throw new OError('invalid SSO arguments', {
      externalUserId,
      providerId,
    })
  }

  const query = _getUserQuery(providerId, externalUserId)
  const user = await User.findOne(query).exec()
  if (!user) {
    throw new Errors.ThirdPartyUserNotFoundError()
  }
  return user
}

async function login(providerId, externalUserId, externalData) {
  const user = await ThirdPartyIdentityManager.promises.getUser(
    providerId,
    externalUserId
  )
  if (!externalData) {
    return user
  }
  const query = _getUserQuery(providerId, externalUserId)
  const update = _thirdPartyIdentifierUpdate(
    user,
    providerId,
    externalUserId,
    externalData
  )
  return await User.findOneAndUpdate(query, update, { new: true }).exec()
}

async function link(
  userId,
  providerId,
  externalUserId,
  externalData,
  auditLog,
  retry
) {
  const accountLinked = true
  if (!oauthProviders[providerId]) {
    throw new Error('Not a valid provider')
  }

  await UserAuditLogHandler.promises.addEntry(
    userId,
    'link-sso',
    auditLog.initiatorId,
    auditLog.ipAddress,
    {
      providerId,
    }
  )

  const query = {
    _id: userId,
    'thirdPartyIdentifiers.providerId': {
      $ne: providerId,
    },
  }
  const update = {
    $push: {
      thirdPartyIdentifiers: {
        externalUserId,
        externalData,
        providerId,
      },
    },
  }
  // add new tpi only if an entry for the provider does not exist
  // projection includes thirdPartyIdentifiers for tests
  let res
  try {
    res = await User.findOneAndUpdate(query, update, { new: 1 }).exec()
  } catch (err) {
    if (err.code === 11000) {
      throw new Errors.ThirdPartyIdentityExistsError({
        info: { externalUserId },
      })
    }
    throw err
  }

  if (res) {
    _sendSecurityAlert(accountLinked, providerId, res, userId)
    return res
  }

  if (retry) {
    // if already retried then throw error
    throw new Error('update failed')
  }

  // attempt to clear existing entry then retry
  await ThirdPartyIdentityManager.promises.unlink(userId, providerId, auditLog)
  return await ThirdPartyIdentityManager.promises.link(
    userId,
    providerId,
    externalUserId,
    externalData,
    auditLog,
    true
  )
}

async function unlink(userId, providerId, auditLog) {
  const accountLinked = false
  if (!oauthProviders[providerId]) {
    throw new Error('Not a valid provider')
  }

  await UserAuditLogHandler.promises.addEntry(
    userId,
    'unlink-sso',
    auditLog.initiatorId,
    auditLog.ipAddress,
    {
      ...(auditLog.extraInfo || {}),
      providerId,
    }
  )

  const query = {
    _id: userId,
  }
  const update = {
    $pull: {
      thirdPartyIdentifiers: {
        providerId,
      },
    },
  }
  // projection includes thirdPartyIdentifiers for tests
  const res = await User.findOneAndUpdate(query, update, { new: 1 })
  if (!res) {
    throw new Error('update failed')
  }
  _sendSecurityAlert(accountLinked, providerId, res, userId)
  return res
}

function _getUserQuery(providerId, externalUserId) {
  externalUserId = externalUserId.toString()
  providerId = providerId.toString()
  const query = {
    'thirdPartyIdentifiers.externalUserId': externalUserId,
    'thirdPartyIdentifiers.providerId': providerId,
  }
  return query
}

function _sendSecurityAlert(accountLinked, providerId, user, userId) {
  const providerName = oauthProviders[providerId].name
  const emailOptions = EmailOptionsHelper.linkOrUnlink(
    accountLinked,
    providerName,
    user.email
  )
  EmailHandler.promises
    .sendEmail('securityAlert', emailOptions)
    .catch(error => {
      logger.error(
        { err: error, userId },
        `could not send security alert email when ${emailOptions.action.toLowerCase()}`
      )
    })
}

function _thirdPartyIdentifierUpdate(
  user,
  providerId,
  externalUserId,
  externalData
) {
  providerId = providerId.toString()
  // get third party identifier object from array
  const thirdPartyIdentifier = user.thirdPartyIdentifiers.find(
    tpi =>
      tpi.externalUserId === externalUserId && tpi.providerId === providerId
  )
  // do recursive merge of new data over existing data
  _.merge(thirdPartyIdentifier.externalData, externalData)
  const update = { 'thirdPartyIdentifiers.$': thirdPartyIdentifier }
  return update
}

const ThirdPartyIdentityManager = {
  getUser: callbackify(getUser),
  login: callbackify(login),
  link: callbackify(link),
  unlink: callbackify(unlink),
}

ThirdPartyIdentityManager.promises = {
  getUser,
  login,
  link,
  unlink,
}

export default ThirdPartyIdentityManager
