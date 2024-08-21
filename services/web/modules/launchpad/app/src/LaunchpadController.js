const OError = require('@overleaf/o-error')
const { expressify } = require('@overleaf/promise-utils')
const Settings = require('@overleaf/settings')
const Path = require('path')
const logger = require('@overleaf/logger')
const UserRegistrationHandler = require('../../../../app/src/Features/User/UserRegistrationHandler')
const EmailHandler = require('../../../../app/src/Features/Email/EmailHandler')
const UserGetter = require('../../../../app/src/Features/User/UserGetter')
const { User } = require('../../../../app/src/models/User')
const AuthenticationManager = require('../../../../app/src/Features/Authentication/AuthenticationManager')
const AuthenticationController = require('../../../../app/src/Features/Authentication/AuthenticationController')
const SessionManager = require('../../../../app/src/Features/Authentication/SessionManager')
const {
  hasAdminAccess,
} = require('../../../../app/src/Features/Helpers/AdminAuthorizationHelper')

const _LaunchpadController = {
  _getAuthMethod() {
    if (Settings.ldap) {
      return 'ldap'
    } else if (Settings.saml) {
      return 'saml'
    } else {
      return 'local'
    }
  },

  async launchpadPage(req, res) {
    // TODO: check if we're using external auth?
    //   * how does all this work with ldap and saml?
    const sessionUser = SessionManager.getSessionUser(req.session)
    const authMethod = LaunchpadController._getAuthMethod()
    const adminUserExists = await LaunchpadController._atLeastOneAdminExists()
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
      const user = await UserGetter.promises.getUser(sessionUser._id, {
        isAdmin: 1,
      })
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
  },

  async _atLeastOneAdminExists() {
    const user = await UserGetter.promises.getUser(
      { isAdmin: true },
      { _id: 1, isAdmin: 1 }
    )
    return Boolean(user)
  },

  async sendTestEmail(req, res) {
    const { email } = req.body
    if (!email) {
      logger.debug({}, 'no email address supplied')
      return res.status(400).json({
        message: 'no email address supplied',
      })
    }
    logger.debug({ email }, 'sending test email')
    const emailOptions = { to: email }
    try {
      await EmailHandler.promises.sendEmail('testEmail', emailOptions)
      logger.debug({ email }, 'sent test email')
      res.json({ message: res.locals.translate('email_sent') })
    } catch (err) {
      OError.tag(err, 'error sending test email', {
        email,
      })
      throw err
    }
  },

  registerExternalAuthAdmin(authMethod) {
    return expressify(async function (req, res) {
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

      const exists = await LaunchpadController._atLeastOneAdminExists()

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

      let user
      try {
        user = await UserRegistrationHandler.promises.registerNewUser(body)
      } catch (err) {
        OError.tag(err, 'error with registerNewUser', {
          email,
          authMethod,
        })
        throw err
      }

      try {
        const reversedHostname = user.email
          .split('@')[1]
          .split('')
          .reverse()
          .join('')
        await User.updateOne(
          { _id: user._id },
          {
            $set: { isAdmin: true, emails: [{ email, reversedHostname }] },
          }
        ).exec()
      } catch (err) {
        OError.tag(err, 'error setting user to admin', {
          user_id: user._id,
        })
        throw err
      }

      AuthenticationController.setRedirectInSession(req, '/launchpad')
      logger.debug(
        { email, userId: user._id, authMethod },
        'created first admin account'
      )

      res.json({ redir: '/launchpad', email })
    })
  },

  async registerAdmin(req, res) {
    const { email } = req.body
    const { password } = req.body
    if (!email || !password) {
      logger.debug({}, 'must supply both email and password, disallow')
      return res.sendStatus(400)
    }

    logger.debug({ email }, 'attempted register first admin user')
    const exists = await LaunchpadController._atLeastOneAdminExists()

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

    const user = await UserRegistrationHandler.promises.registerNewUser(body)

    logger.debug({ userId: user._id }, 'making user an admin')

    try {
      const reversedHostname = user.email
        .split('@')[1]
        .split('')
        .reverse()
        .join('')
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            isAdmin: true,
            emails: [{ email, reversedHostname }],
          },
        }
      ).exec()
    } catch (err) {
      OError.tag(err, 'error setting user to admin', {
        user_id: user._id,
      })
      throw err
    }

    logger.debug({ email, userId: user._id }, 'created first admin account')
    res.json({ redir: '/launchpad' })
  },
}

const LaunchpadController = {
  launchpadPage: expressify(_LaunchpadController.launchpadPage),
  registerAdmin: expressify(_LaunchpadController.registerAdmin),
  registerExternalAuthAdmin: _LaunchpadController.registerExternalAuthAdmin,
  sendTestEmail: expressify(_LaunchpadController.sendTestEmail),
  _atLeastOneAdminExists: _LaunchpadController._atLeastOneAdminExists,
  _getAuthMethod: _LaunchpadController._getAuthMethod,
}

module.exports = LaunchpadController
