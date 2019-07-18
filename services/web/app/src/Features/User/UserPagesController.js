const UserGetter = require('./UserGetter')
const UserSessionsManager = require('./UserSessionsManager')
const ErrorController = require('../Errors/ErrorController')
const logger = require('logger-sharelatex')
const Settings = require('settings-sharelatex')
const AuthenticationController = require('../Authentication/AuthenticationController')

const UserPagesController = {
  registerPage(req, res) {
    const sharedProjectData = {
      project_name: req.query.project_name,
      user_first_name: req.query.user_first_name
    }

    const newTemplateData = {}
    if (req.session.templateData != null) {
      newTemplateData.templateName = req.session.templateData.templateName
    }

    res.render('user/register', {
      title: 'register',
      sharedProjectData,
      newTemplateData,
      new_email: req.query.new_email || ''
    })
  },

  activateAccountPage(req, res, next) {
    // An 'activation' is actually just a password reset on an account that
    // was set with a random password originally.
    logger.log({ query: req.query }, 'activiate account page called')
    if (req.query.user_id == null || req.query.token == null) {
      return ErrorController.notFound(req, res)
    }

    UserGetter.getUser(
      req.query.user_id,
      { email: 1, loginCount: 1 },
      (error, user) => {
        if (error != null) {
          return next(error)
        }
        if (!user) {
          return ErrorController.notFound(req, res)
        }
        if (user.loginCount > 0) {
          logger.log(
            { user },
            'user has already logged in so is active, sending them to /login'
          )
          // Already seen this user, so account must be activate
          // This lets users keep clicking the 'activate' link in their email
          // as a way to log in which, if I know our users, they will.
          res.redirect(`/login?email=${encodeURIComponent(user.email)}`)
        } else {
          res.render('user/activate', {
            title: 'activate_account',
            email: user.email,
            token: req.query.token
          })
        }
      }
    )
  },

  loginPage(req, res) {
    // if user is being sent to /login with explicit redirect (redir=/foo),
    // such as being sent from the editor to /login, then set the redirect explicitly
    if (
      req.query.redir != null &&
      AuthenticationController._getRedirectFromSession(req) == null
    ) {
      logger.log(
        { redir: req.query.redir },
        'setting explicit redirect from login page'
      )
      AuthenticationController.setRedirectInSession(req, req.query.redir)
    }
    res.render('user/login', {
      title: 'login',
      email: req.query.email
    })
  },

  /**
   * Landing page for users who may have received one-time login
   * tokens from the read-only maintenance site.
   *
   * We tell them that Overleaf is back up and that they can login normally.
   */
  oneTimeLoginPage(req, res, next) {
    res.render('user/one_time_login')
  },

  logoutPage(req, res) {
    res.render('user/logout')
  },

  renderReconfirmAccountPage(req, res) {
    const pageData = {
      reconfirm_email: req.session.reconfirm_email
    }
    // when a user must reconfirm their account
    res.render('user/reconfirm', pageData)
  },

  settingsPage(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    const ssoError = req.session.ssoError
    if (ssoError) {
      delete req.session.ssoError
    }
    logger.log({ user: userId }, 'loading settings page')
    let shouldAllowEditingDetails = true
    if (Settings.ldap && Settings.ldap.updateUserDetailsOnLogin) {
      shouldAllowEditingDetails = false
    }
    if (Settings.saml && Settings.saml.updateUserDetailsOnLogin) {
      shouldAllowEditingDetails = false
    }
    const oauthProviders = Settings.oauthProviders || {}

    UserGetter.getUser(userId, (err, user) => {
      if (err != null) {
        return next(err)
      }
      res.render('user/settings', {
        title: 'account_settings',
        user,
        hasPassword: !!user.hashedPassword,
        shouldAllowEditingDetails,
        languages: Settings.languages,
        accountSettingsTabActive: true,
        oauthProviders: UserPagesController._translateProviderDescriptions(
          oauthProviders,
          req
        ),
        oauthUseV2: Settings.oauthUseV2 || false,
        ssoError: ssoError,
        thirdPartyIds: UserPagesController._restructureThirdPartyIds(user),
        previewOauth: req.query.prvw != null
      })
    })
  },

  sessionsPage(req, res, next) {
    const user = AuthenticationController.getSessionUser(req)
    logger.log({ userId: user._id }, 'loading sessions page')
    UserSessionsManager.getAllUserSessions(
      user,
      [req.sessionID],
      (err, sessions) => {
        if (err != null) {
          logger.warn({ userId: user._id }, 'error getting all user sessions')
          return next(err)
        }
        res.render('user/sessions', {
          title: 'sessions',
          sessions
        })
      }
    )
  },

  _restructureThirdPartyIds(user) {
    // 3rd party identifiers are an array of objects
    // this turn them into a single object, which
    // makes data easier to use in template
    if (
      !user.thirdPartyIdentifiers ||
      user.thirdPartyIdentifiers.length === 0
    ) {
      return null
    }
    return user.thirdPartyIdentifiers.reduce((obj, identifier) => {
      obj[identifier.providerId] = identifier.externalUserId
      return obj
    }, {})
  },

  _translateProviderDescriptions(providers, req) {
    const result = {}
    if (providers) {
      for (let provider in providers) {
        const data = providers[provider]
        data.description = req.i18n.translate(
          data.descriptionKey,
          data.descriptionOptions
        )
        result[provider] = data
      }
    }
    return result
  }
}

module.exports = UserPagesController
