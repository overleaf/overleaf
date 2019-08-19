/* eslint-disable
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let LaunchpadController
const Settings = require('settings-sharelatex')
const Path = require('path')
const Url = require('url')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const UserRegistrationHandler = require('../../../../app/src/Features/User/UserRegistrationHandler')
const EmailHandler = require('../../../../app/src/Features/Email/EmailHandler')
const _ = require('underscore')
const UserGetter = require('../../../../app/src/Features/User/UserGetter')
const { User } = require('../../../../app/src/models/User')
const AuthenticationController = require('../../../../app/src/Features/Authentication/AuthenticationController')

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
    const sessionUser = AuthenticationController.getSessionUser(req)
    const authMethod = LaunchpadController._getAuthMethod()
    return LaunchpadController._atLeastOneAdminExists(function(
      err,
      adminUserExists
    ) {
      if (err != null) {
        return next(err)
      }
      if (!sessionUser) {
        if (!adminUserExists) {
          return res.render(Path.resolve(__dirname, '../views/launchpad'), {
            adminUserExists,
            authMethod
          })
        } else {
          return AuthenticationController._redirectToLoginPage(req, res)
        }
      } else {
        return UserGetter.getUser(sessionUser._id, { isAdmin: 1 }, function(
          err,
          user
        ) {
          if (err != null) {
            return next(err)
          }
          if (user && user.isAdmin) {
            return res.render(Path.resolve(__dirname, '../views/launchpad'), {
              adminUserExists,
              authMethod
            })
          } else {
            return res.redirect('/restricted')
          }
        })
      }
    })
  },

  _atLeastOneAdminExists(callback) {
    if (callback == null) {
      callback = function(err, exists) {}
    }
    return UserGetter.getUser(
      { isAdmin: true },
      { _id: 1, isAdmin: 1 },
      function(err, user) {
        if (err != null) {
          return callback(err)
        }
        return callback(null, user != null)
      }
    )
  },

  sendTestEmail(req, res, next) {
    const { email } = req.body
    if (!email) {
      logger.log({}, 'no email address supplied')
      return res.sendStatus(400)
    }
    logger.log({ email }, 'sending test email')
    const emailOptions = { to: email }
    return EmailHandler.sendEmail('testEmail', emailOptions, function(err) {
      if (err != null) {
        logger.warn({ email }, 'error sending test email')
        return next(err)
      }
      logger.log({ email }, 'sent test email')
      return res.sendStatus(201)
    })
  },

  registerExternalAuthAdmin(authMethod) {
    return function(req, res, next) {
      if (LaunchpadController._getAuthMethod() !== authMethod) {
        logger.log(
          { authMethod },
          'trying to register external admin, but that auth service is not enabled, disallow'
        )
        return res.sendStatus(403)
      }
      const { email } = req.body
      if (!email) {
        logger.log({ authMethod }, 'no email supplied, disallow')
        return res.sendStatus(400)
      }

      logger.log({ email }, 'attempted register first admin user')
      return LaunchpadController._atLeastOneAdminExists(function(err, exists) {
        if (err != null) {
          return next(err)
        }

        if (exists) {
          logger.log(
            { email },
            'already have at least one admin user, disallow'
          )
          return res.sendStatus(403)
        }

        const body = {
          email,
          password: 'password_here',
          first_name: email,
          last_name: ''
        }
        logger.log(
          { body, authMethod },
          'creating admin account for specified external-auth user'
        )

        return UserRegistrationHandler.registerNewUser(body, function(
          err,
          user
        ) {
          if (err != null) {
            logger.warn(
              { err, email, authMethod },
              'error with registerNewUser'
            )
            return next(err)
          }

          return User.update(
            { _id: user._id },
            {
              $set: { isAdmin: true },
              emails: [{ email }]
            },
            function(err) {
              if (err != null) {
                logger.warn(
                  { user_id: user._id, err },
                  'error setting user to admin'
                )
                return next(err)
              }

              AuthenticationController.setRedirectInSession(req, '/launchpad')
              logger.log(
                { email, user_id: user._id, authMethod },
                'created first admin account'
              )

              return res.json({ redir: '/launchpad', email })
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
      logger.log({}, 'must supply both email and password, disallow')
      return res.sendStatus(400)
    }

    logger.log({ email }, 'attempted register first admin user')
    return LaunchpadController._atLeastOneAdminExists(function(err, exists) {
      if (err != null) {
        return next(err)
      }

      if (exists) {
        logger.log(
          { email: req.body.email },
          'already have at least one admin user, disallow'
        )
        return res.sendStatus(403)
      }

      const body = { email, password }
      return UserRegistrationHandler.registerNewUser(body, function(err, user) {
        if (err != null) {
          return next(err)
        }

        logger.log({ user_id: user._id }, 'making user an admin')
        const proceed = () =>
          User.update(
            { _id: user._id },
            {
              $set: {
                isAdmin: true,
                emails: [{ email }]
              }
            },
            function(err) {
              if (err != null) {
                logger.err(
                  { user_id: user._id, err },
                  'error setting user to admin'
                )
                return next(err)
              }

              AuthenticationController.setRedirectInSession(req, '/launchpad')
              logger.log(
                { email, user_id: user._id },
                'created first admin account'
              )
              return res.json({
                redir: '',
                id: user._id.toString(),
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                created: Date.now()
              })
            }
          )

        if (
          Settings.overleaf != null &&
          Settings.createV1AccountOnLogin != null
        ) {
          logger.log(
            { user_id: user._id },
            'Creating backing account in v1 for new admin user'
          )
          const SharelatexAuthController = require('../../../overleaf-integration/app/src/SharelatexAuth/SharelatexAuthController')
          return UserGetter.getUser(user._id, function(err, user) {
            if (err != null) {
              return next(err)
            }
            return SharelatexAuthController._createBackingAccountIfNeeded(
              user,
              req,
              function(err) {
                if (err != null) {
                  return next(err)
                }
                return proceed()
              }
            )
          })
        } else {
          return proceed()
        }
      })
    })
  }
}
