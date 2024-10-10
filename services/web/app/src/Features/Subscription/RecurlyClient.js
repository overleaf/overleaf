const recurly = require('recurly')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const { callbackify } = require('util')
const UserGetter = require('../User/UserGetter')

const recurlySettings = Settings.apis.recurly
const recurlyApiKey = recurlySettings ? recurlySettings.apiKey : undefined

const client = new recurly.Client(recurlyApiKey)

async function getAccountForUserId(userId) {
  try {
    return await client.getAccount(`code-${userId}`)
  } catch (err) {
    if (err instanceof recurly.errors.NotFoundError) {
      // An expected error, we don't need to handle it, just return nothing
      logger.debug({ userId }, 'no recurly account found for user')
    } else {
      throw err
    }
  }
}

async function createAccountForUserId(userId) {
  const user = await UserGetter.promises.getUser(userId, {
    _id: 1,
    first_name: 1,
    last_name: 1,
    email: 1,
  })
  const accountCreate = {
    code: user._id.toString(),
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
  }
  const account = await client.createAccount(accountCreate)
  logger.debug({ userId, account }, 'created recurly account')
  return account
}

async function getSubscription(subscriptionId) {
  return await client.getSubscription(subscriptionId)
}

async function getSubscriptionByUuid(subscriptionUuid) {
  return await client.getSubscription('uuid-' + subscriptionUuid)
}

async function changeSubscription(subscriptionId, body) {
  const change = await client.createSubscriptionChange(subscriptionId, body)
  logger.debug(
    { subscriptionId, changeId: change.id },
    'created subscription change'
  )
  return change
}

async function changeSubscriptionByUuid(subscriptionUuid, ...args) {
  return await changeSubscription('uuid-' + subscriptionUuid, ...args)
}

async function removeSubscriptionChange(subscriptionId) {
  const removed = await client.removeSubscriptionChange(subscriptionId)
  logger.debug({ subscriptionId }, 'removed pending subscription change')
  return removed
}

async function removeSubscriptionChangeByUuid(subscriptionUuid) {
  return await removeSubscriptionChange('uuid-' + subscriptionUuid)
}

async function reactivateSubscriptionByUuid(subscriptionUuid) {
  return await client.reactivateSubscription('uuid-' + subscriptionUuid)
}

async function cancelSubscriptionByUuid(subscriptionUuid) {
  try {
    return await client.cancelSubscription('uuid-' + subscriptionUuid)
  } catch (err) {
    if (err instanceof recurly.errors.ValidationError) {
      if (
        err.message === 'Only active and future subscriptions can be canceled.'
      ) {
        logger.debug(
          { subscriptionUuid },
          'subscription cancellation failed, subscription not active'
        )
      }
    } else {
      throw err
    }
  }
}

function subscriptionIsCanceledOrExpired(subscription) {
  const state = subscription?.recurlyStatus?.state
  return state === 'canceled' || state === 'expired'
}

module.exports = {
  errors: recurly.errors,

  getAccountForUserId: callbackify(getAccountForUserId),
  createAccountForUserId: callbackify(createAccountForUserId),
  getSubscription: callbackify(getSubscription),
  getSubscriptionByUuid: callbackify(getSubscriptionByUuid),
  changeSubscription: callbackify(changeSubscription),
  changeSubscriptionByUuid: callbackify(changeSubscriptionByUuid),
  removeSubscriptionChange: callbackify(removeSubscriptionChange),
  removeSubscriptionChangeByUuid: callbackify(removeSubscriptionChangeByUuid),
  reactivateSubscriptionByUuid: callbackify(reactivateSubscriptionByUuid),
  cancelSubscriptionByUuid: callbackify(cancelSubscriptionByUuid),
  subscriptionIsCanceledOrExpired,

  promises: {
    getSubscription,
    getSubscriptionByUuid,
    getAccountForUserId,
    createAccountForUserId,
    changeSubscription,
    changeSubscriptionByUuid,
    removeSubscriptionChange,
    removeSubscriptionChangeByUuid,
    reactivateSubscriptionByUuid,
    cancelSubscriptionByUuid,
  },
}
