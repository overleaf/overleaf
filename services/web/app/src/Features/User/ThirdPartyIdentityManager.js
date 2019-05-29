/* eslint-disable
    camelcase,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ThirdPartyIdentityManager
const Errors = require('../Errors/Errors')
const { User } = require('../../models/User')
const { UserStub } = require('../../models/UserStub')
const UserUpdater = require('./UserUpdater')
const _ = require('lodash')

module.exports = ThirdPartyIdentityManager = {
  getUser(providerId, externalUserId, callback) {
    if (providerId == null || externalUserId == null) {
      return callback(new Error('invalid arguments'))
    }
    const query = ThirdPartyIdentityManager._getUserQuery(
      providerId,
      externalUserId
    )
    return User.findOne(query, function(err, user) {
      if (err != null) {
        return callback(err)
      }
      if (!user) {
        return callback(new Errors.ThirdPartyUserNotFoundError())
      }
      return callback(null, user)
    })
  },

  login(providerId, externalUserId, externalData, callback) {
    return ThirdPartyIdentityManager.getUser(
      providerId,
      externalUserId,
      function(err, user) {
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
        return User.findOneAndUpdate(query, update, { new: true }, callback)
      }
    )
  },

  // attempt to login normally but check for user stub if user not found
  loginUserStub(providerId, externalUserId, externalData, callback) {
    return ThirdPartyIdentityManager.login(
      providerId,
      externalUserId,
      externalData,
      function(err, user) {
        if (err == null) {
          return callback(null, user)
        }
        if (err.name !== 'ThirdPartyUserNotFoundError') {
          return callback(err)
        }
        const query = ThirdPartyIdentityManager._getUserQuery(
          providerId,
          externalUserId
        )
        return UserStub.findOne(query, function(err, userStub) {
          if (err != null) {
            return callback(err)
          }
          if (!userStub) {
            return callback(new Errors.ThirdPartyUserNotFoundError())
          }
          if (!externalData) {
            return callback(null, userStub)
          }
          const update = ThirdPartyIdentityManager._thirdPartyIdentifierUpdate(
            userStub,
            providerId,
            externalUserId,
            externalData
          )
          return UserStub.findOneAndUpdate(
            query,
            update,
            { new: true },
            callback
          )
        })
      }
    )
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

  link(user_id, providerId, externalUserId, externalData, callback, retry) {
    const query = {
      _id: user_id,
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
    return UserUpdater.updateUser(query, update, function(err, res) {
      if (err != null) {
        return callback(err)
      }
      if (res.nModified === 1) {
        return callback(null, res)
      }
      // if already retried then throw error
      if (retry) {
        return callback(new Error('update failed'))
      }
      // attempt to clear existing entry then retry
      return ThirdPartyIdentityManager.unlink(user_id, providerId, function(
        err
      ) {
        if (err != null) {
          return callback(err)
        }
        return ThirdPartyIdentityManager.link(
          user_id,
          providerId,
          externalUserId,
          externalData,
          callback,
          true
        )
      })
    })
  },

  unlink(user_id, providerId, callback) {
    const update = {
      $pull: {
        thirdPartyIdentifiers: {
          providerId
        }
      }
    }
    return UserUpdater.updateUser(user_id, update, callback)
  },

  // attempt to unlink user but unlink user stub if not linked to user
  unlinkUserStub(user_id, providerId, callback) {
    return ThirdPartyIdentityManager.unlink(user_id, providerId, function(
      err,
      res
    ) {
      if (err != null) {
        return callback(err)
      }
      if (res.nModified === 1) {
        return callback(null, res)
      }
      const update = {
        $pull: {
          thirdPartyIdentifiers: {
            providerId
          }
        }
      }
      return UserStub.update({ _id: user_id }, update, callback)
    })
  }
}
