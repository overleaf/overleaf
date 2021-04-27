const recurly = require('recurly')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const { callbackify } = require('util')
const UserGetter = require('../User/UserGetter')

const recurlySettings = Settings.apis.recurly
const recurlyApiKey = recurlySettings ? recurlySettings.apiKey : undefined

const client = new recurly.Client(recurlyApiKey)

module.exports = {
  errors: recurly.errors,

  getAccountForUserId: callbackify(getAccountForUserId),
  createAccountForUserId: callbackify(createAccountForUserId),

  promises: {
    getAccountForUserId,
    createAccountForUserId,
  },
}

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
  logger.log({ userId, account }, 'created recurly account')
  return account
}
