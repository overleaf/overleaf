/* eslint-disable
    n/handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let LaunchpadController
const OError = require('@overleaf/o-error')
const Settings = require('@overleaf/settings')
const Path = require('path')
const Url = require('url')
const logger = require('@overleaf/logger')
const metrics = require('@overleaf/metrics')
const UserRegistrationHandler = require('../../../../app/src/Features/User/UserRegistrationHandler')
const EmailHandler = require('../../../../app/src/Features/Email/EmailHandler')
const _ = require('underscore')
const UserGetter = require('../../../../app/src/Features/User/UserGetter')
const { User } = require('../../../../app/src/models/User')
const AuthenticationManager = require('../../../../app/src/Features/Authentication/AuthenticationManager')
const AuthenticationController = require('../../../../app/src/Features/Authentication/AuthenticationController')
const SessionManager = require('../../../../app/src/Features/Authentication/SessionManager')
const {
  hasAdminAccess,
} = require('../../../../app/src/Features/Helpers/AdminAuthorizationHelper')

module.exports = LaunchpadController = {
  _getAuthMethod() {
    if (Settings.ldap) {
      return 'ldap'
    } else if (Settings.saml) {
      return 'saml'
    } else {
      return 'local'
    }
  },

  launchpadPage(req, res, next) {
    // TODO: check if we're using external auth?
    //   * how does all this work with ldap and saml?
    const sessionUser = SessionManager.getSessionUser(req.session)
    const authMethod = LaunchpadController._getAuthMethod()
    LaunchpadController._atLeastOneAdminExists(function (err, adminUserExists) {
      if (err != null) {
        return next(err)
      }
      if (!sessionUser) {
        if (!adminUserExists) {
          res.render(Path.resolve(__dirname, '../views/launchpad'), {
            adminUserExists,
            authMethod,
          })
        } else {
          AuthenticationController.setRedirectInSession(req)
          res.redirect('/login')
        }
      } else {
        UserGetter.getUser(
          sessionUser._id,
          { isAdmin: 1 },
          function (err, user) {
            if (err != null) {
              return next(err)
            }
            if (hasAdminAccess(user)) {
              res.render(Path.resolve(__dirname, '../views/launchpad'), {
                wsUrl: Settings.wsUrl,
                adminUserExists,
                authMethod,
              })
            } else {
              res.redirect('/restricted')
            }
          }
        )
      }
    })
  },

  _atLeastOneAdminExists(callback) {
    if (callback == null) {
      callback = function () {}
    }
    UserGetter.getUser(
      { isAdmin: true },
      { _id: 1, isAdmin: 1 },
      function (err, user) {
        if (err != null) {
          return callback(err)
        }
        callback(null, user != null)
      }
    )
  },

  sendTestEmail(req, res, next) {
    const { email } = req.body
    if (!email) {
      logger.debug({}, 'no email address supplied')
      return res.status(400).json({
        message: 'no email address supplied',
      })
    }
    logger.debug({ email }, 'sending test email')
    const emailOptions = { to: email }
    EmailHandler.sendEmail('testEmail', emailOptions, function (err) {
      if (err != null) {
        OError.tag(err, 'error sending test email', {
          email,
        })
        return next(err)
      }
      logger.debug({ email }, 'sent test email')
      res.json({ message: res.locals.translate('email_sent') })
    })
  },

  registerExternalAuthAdmin(authMethod) {
    return function (req, res, next) {
      if (LaunchpadController._getAuthMethod() !== authMethod) {
        logger.debug(
          { authMethod },
          'trying to register external admin, but that auth service is not enabled, disallow'
        )
        return res.sendStatus(403)
      }
      const { email } = req.body
      if (!email) {
        logger.debug({ authMethod }, 'no email supplied, disallow')
        return res.sendStatus(400)
      }

      logger.debug({ email }, 'attempted register first admin user')
      LaunchpadController._atLeastOneAdminExists(function (err, exists) {
        if (err != null) {
          return next(err)
        }

        if (exists) {
          logger.debug(
            { email },
            'already have at least one admin user, disallow'
          )
          return res.sendStatus(403)
        }

        const body = {
          email,
          password: 'password_here',
          first_name: email,
          last_name: '',
        }
        logger.debug(
          { body, authMethod },
          'creating admin account for specified external-auth user'
        )

        UserRegistrationHandler.registerNewUser(body, function (err, user) {
          if (err != null) {
            OError.tag(err, 'error with registerNewUser', {
              email,
              authMethod,
            })
            return next(err)
          }

          User.updateOne(
            { _id: user._id },
            {
              $set: { isAdmin: true },
              emails: [{ email }],
            },
            function (err) {
              if (err != null) {
                OError.tag(err, 'error setting user to admin', {
                  user_id: user._id,
                })
                return next(err)
              }

              AuthenticationController.setRedirectInSession(req, '/launchpad')
              logger.debug(
                { email, userId: user._id, authMethod },
                'created first admin account'
              )

              res.json({ redir: '/launchpad', email })
            }
          )
        })
      })
    }
  },

  registerAdmin(req, res, next) {
    const { email } = req.body
    const { password } = req.body
    if (!email || !password) {
      logger.debug({}, 'must supply both email and password, disallow')
      return res.sendStatus(400)
    }

    logger.debug({ email }, 'attempted register first admin user')
    LaunchpadController._atLeastOneAdminExists(function (err, exists) {
      if (err != null) {
        return next(err)
      }

      if (exists) {
        logger.debug(
          { email: req.body.email },
          'already have at least one admin user, disallow'
        )
        return res.status(403).json({
          message: { type: 'error', text: 'admin user already exists' },
        })
      }

      const invalidEmail = AuthenticationManager.validateEmail(email)
      if (invalidEmail) {
        return res
          .status(400)
          .json({ message: { type: 'error', text: invalidEmail.message } })
      }

      const invalidPassword = AuthenticationManager.validatePassword(
        password,
        email
      )
      if (invalidPassword) {
        return res
          .status(400)
          .json({ message: { type: 'error', text: invalidPassword.message } })
      }

      const body = { email, password }
      UserRegistrationHandler.registerNewUser(body, function (err, user) {
        if (err != null) {
          return next(err)
        }

        logger.debug({ userId: user._id }, 'making user an admin')
        User.updateOne(
          { _id: user._id },
          {
            $set: {
              isAdmin: true,
              emails: [{ email }],
            },
          },
          function (err) {
            if (err != null) {
              OError.tag(err, 'error setting user to admin', {
                user_id: user._id,
              })
              return next(err)
            }

            logger.debug(
              { email, userId: user._id },
              'created first admin account'
            )
            res.json({ redir: '/launchpad' })
          }
        )
      })
    })
  },
}
