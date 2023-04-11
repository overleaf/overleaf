const Settings = require('@overleaf/settings')
const { User } = require('../../models/User')
const { db, ObjectId } = require('../../infrastructure/mongodb')
const bcrypt = require('bcrypt')
const EmailHelper = require('../Helpers/EmailHelper')
const {
  InvalidEmailError,
  InvalidPasswordError,
  ParallelLoginError,
  PasswordMustBeDifferentError,
  PasswordReusedError,
} = require('./AuthenticationErrors')
const util = require('util')
const HaveIBeenPwned = require('./HaveIBeenPwned')
const UserAuditLogHandler = require('../User/UserAuditLogHandler')
const logger = require('@overleaf/logger')
const DiffHelper = require('../Helpers/DiffHelper')
const Metrics = require('@overleaf/metrics')

const BCRYPT_ROUNDS = Settings.security.bcryptRounds || 12
const BCRYPT_MINOR_VERSION = Settings.security.bcryptMinorVersion || 'a'
const MAX_SIMILARITY = 0.7

function _exceedsMaximumLengthRatio(password, maxSimilarity, value) {
  const passwordLength = password.length
  const lengthBoundSimilarity = (maxSimilarity / 2) * passwordLength
  const valueLength = value.length
  return (
    passwordLength >= 10 * valueLength && valueLength < lengthBoundSimilarity
  )
}

const _checkWriteResult = function (result, callback) {
  // for MongoDB
  if (result && result.modifiedCount === 1) {
    callback(null, true)
  } else {
    callback(null, false)
  }
}

function _validatePasswordNotTooLong(password) {
  // bcrypt has a hard limit of 72 characters.
  if (password.length > 72) {
    return new InvalidPasswordError({
      message: 'password is too long',
      info: { code: 'too_long' },
    })
  }
  return null
}

function _metricsForSuccessfulPasswordMatch(password) {
  const validationResult = AuthenticationManager.validatePassword(password)
  const status =
    validationResult === null ? 'success' : validationResult?.info?.code
  Metrics.inc('check-password', { status })
  return null
}

const AuthenticationManager = {
  _checkUserPassword(query, password, callback) {
    // Using Mongoose for legacy reasons here. The returned User instance
    // gets serialized into the session and there may be subtle differences
    // between the user returned by Mongoose vs mongodb (such as default values)
    User.findOne(query, (error, user) => {
      if (error) {
        return callback(error)
      }
      if (!user || !user.hashedPassword) {
        return callback(null, null, null)
      }
      bcrypt.compare(password, user.hashedPassword, function (error, match) {
        if (error) {
          return callback(error)
        }
        if (match) {
          _metricsForSuccessfulPasswordMatch(password)
        }
        callback(null, user, match)
      })
    })
  },

  authenticate(query, password, auditLog, callback) {
    if (typeof callback === 'undefined') {
      callback = auditLog
      auditLog = null
    }
    AuthenticationManager._checkUserPassword(
      query,
      password,
      (error, user, match) => {
        if (error) {
          return callback(error)
        }
        if (!user) {
          return callback(null, null)
        }
        const update = { $inc: { loginEpoch: 1 } }
        if (!match) {
          update.$set = { lastFailedLogin: new Date() }
        }
        User.updateOne(
          { _id: user._id, loginEpoch: user.loginEpoch },
          update,
          {},
          (err, result) => {
            if (err) {
              return callback(err)
            }
            if (result.modifiedCount !== 1) {
              return callback(new ParallelLoginError())
            }
            if (!match) {
              if (!auditLog) {
                return callback(null, null)
              } else {
                return UserAuditLogHandler.addEntry(
                  user._id,
                  'failed-password-match',
                  user._id,
                  auditLog.ipAddress,
                  auditLog.info,
                  err => {
                    if (err) {
                      logger.error(
                        { userId: user._id, err, info: auditLog.info },
                        'Error while adding AuditLog entry for failed-password-match'
                      )
                    }
                    callback(null, null)
                  }
                )
              }
            }
            AuthenticationManager.checkRounds(
              user,
              user.hashedPassword,
              password,
              function (err) {
                if (err) {
                  return callback(err)
                }
                callback(null, user)
                HaveIBeenPwned.checkPasswordForReuseInBackground(password)
              }
            )
          }
        )
      }
    )
  },

  validateEmail(email) {
    const parsed = EmailHelper.parseEmail(email)
    if (!parsed) {
      return new InvalidEmailError({ message: 'email not valid' })
    }
    return null
  },

  // validates a password based on a similar set of rules to `complexPassword.js` on the frontend
  // note that `passfield.js` enforces more rules than this, but these are the most commonly set.
  // returns null on success, or an error object.
  validatePassword(password, email) {
    if (password == null) {
      return new InvalidPasswordError({
        message: 'password not set',
        info: { code: 'not_set' },
      })
    }

    Metrics.inc('try-validate-password')

    let allowAnyChars, min, max
    if (Settings.passwordStrengthOptions) {
      allowAnyChars = Settings.passwordStrengthOptions.allowAnyChars === true
      if (Settings.passwordStrengthOptions.length) {
        min = Settings.passwordStrengthOptions.length.min
        max = Settings.passwordStrengthOptions.length.max
      }
    }
    allowAnyChars = !!allowAnyChars
    min = min || 8
    max = max || 72

    // we don't support passwords > 72 characters in length, because bcrypt truncates them
    if (max > 72) {
      max = 72
    }

    if (password.length < min) {
      return new InvalidPasswordError({
        message: 'password is too short',
        info: { code: 'too_short' },
      })
    }
    if (password.length > max) {
      return new InvalidPasswordError({
        message: 'password is too long',
        info: { code: 'too_long' },
      })
    }
    const passwordLengthError = _validatePasswordNotTooLong(password)
    if (passwordLengthError) {
      return passwordLengthError
    }
    if (
      !allowAnyChars &&
      !AuthenticationManager._passwordCharactersAreValid(password)
    ) {
      return new InvalidPasswordError({
        message: 'password contains an invalid character',
        info: { code: 'invalid_character' },
      })
    }
    if (typeof email === 'string' && email !== '') {
      const startOfEmail = email.split('@')[0]
      if (
        password.includes(email) ||
        password.includes(startOfEmail) ||
        email.includes(password)
      ) {
        return new InvalidPasswordError({
          message: 'password contains part of email address',
          info: { code: 'contains_email' },
        })
      }
      try {
        const passwordTooSimilarError =
          AuthenticationManager._validatePasswordNotTooSimilar(password, email)
        if (passwordTooSimilarError) {
          Metrics.inc('password-too-similar-to-email')
          return new InvalidPasswordError({
            message: 'password is too similar to email address',
            info: { code: 'too_similar' },
          })
        }
      } catch (error) {
        logger.error(
          { error },
          'error while checking password similarity to email'
        )
      }
      // TODO: remove this check once the password-too-similar checks are active?
    }
    return null
  },

  setUserPassword(user, password, callback) {
    AuthenticationManager.setUserPasswordInV2(user, password, callback)
  },

  checkRounds(user, hashedPassword, password, callback) {
    // Temporarily disable this function, TODO: re-enable this
    if (Settings.security.disableBcryptRoundsUpgrades) {
      return callback()
    }
    // check current number of rounds and rehash if necessary
    const currentRounds = bcrypt.getRounds(hashedPassword)
    if (currentRounds < BCRYPT_ROUNDS) {
      AuthenticationManager._setUserPasswordInMongo(user, password, callback)
    } else {
      callback()
    }
  },

  hashPassword(password, callback) {
    // Double-check the size to avoid truncating in bcrypt.
    const error = _validatePasswordNotTooLong(password)
    if (error) {
      return callback(error)
    }
    bcrypt.genSalt(BCRYPT_ROUNDS, BCRYPT_MINOR_VERSION, function (error, salt) {
      if (error) {
        return callback(error)
      }
      bcrypt.hash(password, salt, callback)
    })
  },

  setUserPasswordInV2(user, password, callback) {
    if (!user || !user.email || !user._id) {
      return callback(new Error('invalid user object'))
    }
    const validationError = this.validatePassword(password, user.email)
    if (validationError) {
      return callback(validationError)
    }
    // check if we can log in with this password. In which case we should reject it,
    // because it is the same as the existing password.
    AuthenticationManager._checkUserPassword(
      { _id: user._id },
      password,
      (err, _user, match) => {
        if (err) {
          return callback(err)
        }
        if (match) {
          return callback(new PasswordMustBeDifferentError())
        }

        HaveIBeenPwned.checkPasswordForReuse(
          password,
          (error, isPasswordReused) => {
            if (error) {
              logger.err({ error }, 'cannot check password for re-use')
            }

            if (!error && isPasswordReused) {
              return callback(new PasswordReusedError())
            }

            // password is strong enough or the validation with the service did not happen
            this._setUserPasswordInMongo(user, password, callback)
          }
        )
      }
    )
  },

  _setUserPasswordInMongo(user, password, callback) {
    this.hashPassword(password, function (error, hash) {
      if (error) {
        return callback(error)
      }
      db.users.updateOne(
        { _id: ObjectId(user._id.toString()) },
        {
          $set: {
            hashedPassword: hash,
          },
          $unset: {
            password: true,
          },
        },
        function (updateError, result) {
          if (updateError) {
            return callback(updateError)
          }
          _checkWriteResult(result, callback)
        }
      )
    })
  },

  _passwordCharactersAreValid(password) {
    let digits, letters, lettersUp, symbols
    if (
      Settings.passwordStrengthOptions &&
      Settings.passwordStrengthOptions.chars
    ) {
      digits = Settings.passwordStrengthOptions.chars.digits
      letters = Settings.passwordStrengthOptions.chars.letters
      lettersUp = Settings.passwordStrengthOptions.chars.letters_up
      symbols = Settings.passwordStrengthOptions.chars.symbols
    }
    digits = digits || '1234567890'
    letters = letters || 'abcdefghijklmnopqrstuvwxyz'
    lettersUp = lettersUp || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    symbols = symbols || '@#$%^&*()-_=+[]{};:<>/?!£€.,'

    for (let charIndex = 0; charIndex <= password.length - 1; charIndex++) {
      if (
        digits.indexOf(password[charIndex]) === -1 &&
        letters.indexOf(password[charIndex]) === -1 &&
        lettersUp.indexOf(password[charIndex]) === -1 &&
        symbols.indexOf(password[charIndex]) === -1
      ) {
        return false
      }
    }
    return true
  },

  /**
   * Check if the password is similar to (parts of) the email address.
   * For now, this merely sends a metric when the password and
   * email address are deemed to be too similar to each other.
   * Later we will reject passwords that fail this check.
   *
   * This logic was borrowed from the django project:
   * https://github.com/django/django/blob/fa3afc5d86f1f040922cca2029d6a34301597a70/django/contrib/auth/password_validation.py#L159-L214
   */
  _validatePasswordNotTooSimilar(password, email) {
    password = password.toLowerCase()
    email = email.toLowerCase()
    const stringsToCheck = [email]
      .concat(email.split(/\W+/))
      .concat(email.split(/@/))
    for (const emailPart of stringsToCheck) {
      if (!_exceedsMaximumLengthRatio(password, MAX_SIMILARITY, emailPart)) {
        const similarity = DiffHelper.stringSimilarity(password, emailPart)
        if (similarity > MAX_SIMILARITY) {
          logger.warn(
            { email, emailPart, similarity, maxSimilarity: MAX_SIMILARITY },
            'Password too similar to email'
          )
          return new Error('password is too similar to email')
        }
      }
    }
  },

  getMessageForInvalidPasswordError(error, req) {
    const errorCode = error?.info?.code
    const message = {
      type: 'error',
    }
    switch (errorCode) {
      case 'not_set':
        message.key = 'password-not-set'
        message.text = req.i18n.translate('invalid_password_not_set')
        break
      case 'invalid_character':
        message.key = 'password-invalid-character'
        message.text = req.i18n.translate('invalid_password_invalid_character')
        break
      case 'contains_email':
        message.key = 'password-contains-email'
        message.text = req.i18n.translate('invalid_password_contains_email')
        break
      case 'too_similar':
        message.key = 'password-too-similar'
        message.text = req.i18n.translate('invalid_password_too_similar')
        break
      case 'too_short':
        message.key = 'password-too-short'
        message.text = req.i18n.translate('invalid_password_too_short', {
          minLength: Settings.passwordStrengthOptions?.length?.min || 8,
        })
        break
      case 'too_long':
        message.key = 'password-too-long'
        message.text = req.i18n.translate('invalid_password_too_long', {
          maxLength: Settings.passwordStrengthOptions?.length?.max || 72,
        })
        break
      default:
        logger.error({ err: error }, 'Unknown password validation error code')
        message.text = req.i18n.translate('invalid_password')
        break
    }
    return message
  },
}

AuthenticationManager.promises = {
  authenticate: util.promisify(AuthenticationManager.authenticate),
  hashPassword: util.promisify(AuthenticationManager.hashPassword),
  setUserPassword: util.promisify(AuthenticationManager.setUserPassword),
}

module.exports = AuthenticationManager
