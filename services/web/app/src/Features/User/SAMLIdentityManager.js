const Errors = require('../Errors/Errors')
const { User } = require('../../models/User')

async function getUser(providerId, externalUserId) {
  if (providerId == null || externalUserId == null) {
    throw new Error('invalid arguments')
  }
  try {
    const query = SAMLIdentityManager._getUserQuery(providerId, externalUserId)
    let user = await User.findOne(query).exec()
    if (!user) {
      throw new Errors.SAMLUserNotFoundError()
    }
    return user
  } catch (error) {
    throw error
  }
}

const SAMLIdentityManager = {
  _getUserQuery(providerId, externalUserId) {
    externalUserId = externalUserId.toString()
    providerId = providerId.toString()
    const query = {
      'samlIdentifiers.externalUserId': externalUserId,
      'samlIdentifiers.providerId': providerId
    }
    return query
  },
  getUser
}

module.exports = SAMLIdentityManager
