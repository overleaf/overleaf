/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let AuthenticationManager
const Settings = require('settings-sharelatex')
const { User } = require('../../models/User')
const { db, ObjectId } = require('../../infrastructure/mongojs')
const crypto = require('crypto')
const bcrypt = require('bcrypt')
const EmailHelper = require('../Helpers/EmailHelper')
const Errors = require('../Errors/Errors')
const UserGetter = require('../User/UserGetter')
const V1Handler = require('../V1/V1Handler')

const BCRYPT_ROUNDS = Settings.security.bcryptRounds || 12
const BCRYPT_MINOR_VERSION = Settings.security.bcryptMinorVersion || 'a'

const _checkWriteResult = function(result, callback) {
  // for MongoDB
  if (callback == null) {
    callback = function(error, updated) {}
  }
  if (result && result.nModified === 1) {
    return callback(null, true)
  } else {
    return callback(null, false)
  }
}

module.exports = AuthenticationManager = {
  authenticate(query, password, callback) {
    // Using Mongoose for legacy reasons here. The returned User instance
    // gets serialized into the session and there may be subtle differences
    // between the user returned by Mongoose vs mongojs (such as default values)
    if (callback == null) {
      callback = function(error, user) {}
    }
    return User.findOne(query, (error, user) => {
      if (error != null) {
        return callback(error)
      }
      if (user != null) {
        if (user.hashedPassword != null) {
          return bcrypt.compare(password, user.hashedPassword, function(
            error,
            match
          ) {
            if (error != null) {
              return callback(error)
            }
            if (match) {
              return AuthenticationManager.checkRounds(
                user,
                user.hashedPassword,
                password,
                function(err) {
                  if (err != null) {
                    return callback(err)
                  }
                  return callback(null, user)
                }
              )
            } else {
              return callback(null, null)
            }
          })
        } else {
          return callback(null, null)
        }
      } else {
        return callback(null, null)
      }
    })
  },

  validateEmail(email) {
    const parsed = EmailHelper.parseEmail(email)
    if (parsed == null) {
      return { message: 'email not valid' }
    }
    return null
  },

  // validates a password based on a similar set of rules to `complexPassword.js` on the frontend
  // note that `passfield.js` enforces more rules than this, but these are the most commonly set.
  // returns null on success, or an error string.
  validatePassword(password) {
    if (password == null) {
      return { message: 'password not set' }
    }

    let allowAnyChars, min, max
    if (Settings.passwordStrengthOptions) {
      allowAnyChars = Settings.passwordStrengthOptions.allowAnyChars === true
      if (Settings.passwordStrengthOptions.length) {
        min = Settings.passwordStrengthOptions.length.min
        max = Settings.passwordStrengthOptions.length.max
      }
    }
    allowAnyChars = !!allowAnyChars
    min = min || 6
    max = max || 72

    // we don't support passwords > 72 characters in length, because bcrypt truncates them
    if (max > 72) {
      max = 72
    }

    if (!(password.length >= min)) {
      return { message: 'password is too short' }
    }
    if (!(password.length <= max)) {
      return { message: 'password is too long' }
    }
    if (
      !allowAnyChars &&
      !AuthenticationManager._passwordCharactersAreValid(password)
    ) {
      return { message: 'password contains an invalid character' }
    }
    return null
  },

  setUserPassword(user_id, password, callback) {
    AuthenticationManager.setUserPasswordInV2(user_id, password, callback)
  },

  checkRounds(user, hashedPassword, password, callback) {
    // Temporarily disable this function, TODO: re-enable this
    if (callback == null) {
      callback = function(error) {}
    }
    if (Settings.security.disableBcryptRoundsUpgrades) {
      return callback()
    }
    // check current number of rounds and rehash if necessary
    const currentRounds = bcrypt.getRounds(hashedPassword)
    if (currentRounds < BCRYPT_ROUNDS) {
      return AuthenticationManager.setUserPassword(user._id, password, callback)
    } else {
      return callback()
    }
  },

  hashPassword(password, callback) {
    return bcrypt.genSalt(BCRYPT_ROUNDS, BCRYPT_MINOR_VERSION, function(
      error,
      salt
    ) {
      if (error != null) {
        return callback(error)
      }
      return bcrypt.hash(password, salt, callback)
    })
  },

  setUserPasswordInV2(user_id, password, callback) {
    const validation = this.validatePassword(password)
    if (validation != null) {
      return callback(validation.message)
    }
    return this.hashPassword(password, function(error, hash) {
      if (error != null) {
        return callback(error)
      }
      return db.users.update(
        {
          _id: ObjectId(user_id.toString())
        },
        {
          $set: {
            hashedPassword: hash
          },
          $unset: {
            password: true
          }
        },
        function(updateError, result) {
          if (updateError != null) {
            return callback(updateError)
          }
          return _checkWriteResult(result, callback)
        }
      )
    })
  },

  setUserPasswordInV1(v1_user_id, password, callback) {
    const validation = this.validatePassword(password)
    if (validation != null) {
      return callback(validation.message)
    }

    return V1Handler.doPasswordReset(v1_user_id, password, function(
      error,
      reset
    ) {
      if (error != null) {
        return callback(error)
      }
      return callback(error, reset)
    })
  },

  _passwordCharactersAreValid(password) {
    let digits, letters, letters_up, symbols
    if (
      Settings.passwordStrengthOptions &&
      Settings.passwordStrengthOptions.chars
    ) {
      digits = Settings.passwordStrengthOptions.chars.digits
      letters = Settings.passwordStrengthOptions.chars.letters
      letters_up = Settings.passwordStrengthOptions.chars.letters_up
      symbols = Settings.passwordStrengthOptions.chars.symbols
    }
    digits = digits || '1234567890'
    letters = letters || 'abcdefghijklmnopqrstuvwxyz'
    letters_up = letters_up || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    symbols = symbols || '@#$%^&*()-_=+[]{};:<>/?!£€.,'

    for (
      let charIndex = 0, end = password.length - 1, asc = end >= 0;
      asc ? charIndex <= end : charIndex >= end;
      asc ? charIndex++ : charIndex--
    ) {
      if (
        !(digits.indexOf(password[charIndex]) > -1) &&
        !(letters.indexOf(password[charIndex]) > -1) &&
        !(letters_up.indexOf(password[charIndex]) > -1) &&
        !(symbols.indexOf(password[charIndex]) > -1)
      ) {
        return false
      }
    }
    return true
  }
}
