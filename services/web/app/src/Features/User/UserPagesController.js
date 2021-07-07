const UserGetter = require('./UserGetter')
const OError = require('@overleaf/o-error')
const UserSessionsManager = require('./UserSessionsManager')
const logger = require('logger-sharelatex')
const Settings = require('@overleaf/settings')
const AuthenticationController = require('../Authentication/AuthenticationController')
const _ = require('lodash')

const UserPagesController = {
  registerPage(req, res) {
    const sharedProjectData = {
      project_name: req.query.project_name,
      user_first_name: req.query.user_first_name,
    }

    const newTemplateData = {}
    if (req.session.templateData != null) {
      newTemplateData.templateName = req.session.templateData.templateName
    }

    res.render('user/register', {
      title: 'register',
      sharedProjectData,
      newTemplateData,
      samlBeta: req.session.samlBeta,
    })
  },

  loginPage(req, res) {
    // if user is being sent to /login with explicit redirect (redir=/foo),
    // such as being sent from the editor to /login, then set the redirect explicitly
    if (
      req.query.redir != null &&
      AuthenticationController._getRedirectFromSession(req) == null
    ) {
      AuthenticationController.setRedirectInSession(req, req.query.redir)
    }
    res.render('user/login', {
      title: 'login',
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
      reconfirm_email: req.session.reconfirm_email,
    }
    // when a user must reconfirm their account
    res.render('user/reconfirm', pageData)
  },

  settingsPage(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    const reconfirmationRemoveEmail = req.query.remove
    // SSO
    const ssoError = req.session.ssoError
    if (ssoError) {
      delete req.session.ssoError
    }
    // Institution SSO
    let institutionLinked = _.get(req.session, ['saml', 'linked'])
    if (institutionLinked) {
      // copy object if exists because _.get does not
      institutionLinked = Object.assign(
        {
          hasEntitlement: _.get(req.session, ['saml', 'hasEntitlement']),
        },
        institutionLinked
      )
    }
    const samlError = _.get(req.session, ['saml', 'error'])
    const institutionEmailNonCanonical = _.get(req.session, [
      'saml',
      'emailNonCanonical',
    ])
    const institutionRequestedEmail = _.get(req.session, [
      'saml',
      'requestedEmail',
    ])

    const reconfirmedViaSAML = _.get(req.session, ['saml', 'reconfirmed'])
    delete req.session.saml
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
        institutionLinked,
        samlError,
        institutionEmailNonCanonical:
          institutionEmailNonCanonical && institutionRequestedEmail
            ? institutionEmailNonCanonical
            : undefined,
        reconfirmedViaSAML,
        reconfirmationRemoveEmail,
        samlBeta: req.session.samlBeta,
        ssoError: ssoError,
        thirdPartyIds: UserPagesController._restructureThirdPartyIds(user),
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
          OError.tag(err, 'error getting all user sessions', {
            userId: user._id,
          })
          return next(err)
        }
        res.render('user/sessions', {
          title: 'sessions',
          sessions,
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
      for (const provider in providers) {
        const data = providers[provider]
        data.description = req.i18n.translate(
          data.descriptionKey,
          Object.assign({}, data.descriptionOptions)
        )
        result[provider] = data
      }
    }
    return result
  },
}

module.exports = UserPagesController
