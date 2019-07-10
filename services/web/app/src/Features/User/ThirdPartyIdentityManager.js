const EmailHandler = require('../../../../app/src/Features/Email/EmailHandler')
const Errors = require('../Errors/Errors')
const logger = require('logger-sharelatex')
const { User } = require('../../models/User')
const settings = require('settings-sharelatex')
const _ = require('lodash')

const oauthProviders = settings.oauthProviders || {}

const ThirdPartyIdentityManager = (module.exports = {
  getUser(providerId, externalUserId, callback) {
    if (providerId == null || externalUserId == null) {
      return callback(new Error('invalid arguments'))
    }
    const query = ThirdPartyIdentityManager._getUserQuery(
      providerId,
      externalUserId
    )
    User.findOne(query, function(err, user) {
      if (err != null) {
        return callback(err)
      }
      if (!user) {
        return callback(new Errors.ThirdPartyUserNotFoundError())
      }
      callback(null, user)
    })
  },

  login(providerId, externalUserId, externalData, callback) {
    ThirdPartyIdentityManager.getUser(providerId, externalUserId, function(
      err,
      user
    ) {
      if (err != null) {
        return callback(err)
      }
      if (!externalData) {
        return callback(null, user)
      }
      const query = ThirdPartyIdentityManager._getUserQuery(
        providerId,
        externalUserId
      )
      const update = ThirdPartyIdentityManager._thirdPartyIdentifierUpdate(
        user,
        providerId,
        externalUserId,
        externalData
      )
      User.findOneAndUpdate(query, update, { new: true }, callback)
    })
  },

  _getUserQuery(providerId, externalUserId) {
    externalUserId = externalUserId.toString()
    providerId = providerId.toString()
    const query = {
      'thirdPartyIdentifiers.externalUserId': externalUserId,
      'thirdPartyIdentifiers.providerId': providerId
    }
    return query
  },

  _thirdPartyIdentifierUpdate(user, providerId, externalUserId, externalData) {
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
  },

  // register: () ->
  // this should be implemented once we move to having v2 as the master
  // but for now we need to register with v1 then call link once that
  // is complete

  link(userId, providerId, externalUserId, externalData, callback, retry) {
    if (!oauthProviders[providerId]) {
      return callback(new Error('Not a valid provider'))
    }
    const query = {
      _id: userId,
      'thirdPartyIdentifiers.providerId': {
        $ne: providerId
      }
    }
    const update = {
      $push: {
        thirdPartyIdentifiers: {
          externalUserId,
          externalData,
          providerId
        }
      }
    }
    // add new tpi only if an entry for the provider does not exist
    // projection includes thirdPartyIdentifiers for tests
    User.findOneAndUpdate(query, update, { new: 1 }, (err, res) => {
      if (err && err.code === 11000) {
        callback(new Errors.ThirdPartyIdentityExistsError())
      } else if (err != null) {
        callback(err)
      } else if (res) {
        const emailOptions = {
          to: res.email,
          provider: oauthProviders[providerId].name
        }
        EmailHandler.sendEmail(
          'emailThirdPartyIdentifierLinked',
          emailOptions,
          error => {
            if (error != null) {
              logger.warn(error)
            }
            return callback(null, res)
          }
        )
      } else if (retry) {
        // if already retried then throw error
        callback(new Error('update failed'))
      } else {
        // attempt to clear existing entry then retry
        ThirdPartyIdentityManager.unlink(userId, providerId, function(err) {
          if (err != null) {
            return callback(err)
          }
          ThirdPartyIdentityManager.link(
            userId,
            providerId,
            externalUserId,
            externalData,
            callback,
            true
          )
        })
      }
    })
  },

  unlink(userId, providerId, callback) {
    if (!oauthProviders[providerId]) {
      return callback(new Error('Not a valid provider'))
    }
    const query = {
      _id: userId
    }
    const update = {
      $pull: {
        thirdPartyIdentifiers: {
          providerId
        }
      }
    }
    // projection includes thirdPartyIdentifiers for tests
    User.findOneAndUpdate(query, update, { new: 1 }, (err, res) => {
      if (err != null) {
        callback(err)
      } else if (!res) {
        callback(new Error('update failed'))
      } else {
        const emailOptions = {
          to: res.email,
          provider: oauthProviders[providerId].name
        }
        EmailHandler.sendEmail(
          'emailThirdPartyIdentifierUnlinked',
          emailOptions,
          error => {
            if (error != null) {
              logger.warn(error)
            }
            return callback(null, res)
          }
        )
      }
    })
  }
})
