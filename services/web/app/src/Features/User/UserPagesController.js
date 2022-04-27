const UserGetter = require('./UserGetter')
const OError = require('@overleaf/o-error')
const UserSessionsManager = require('./UserSessionsManager')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const AuthenticationController = require('../Authentication/AuthenticationController')
const SessionManager = require('../Authentication/SessionManager')
const NewsletterManager = require('../Newsletter/NewsletterManager')
const _ = require('lodash')
const { expressify } = require('../../util/promises')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')

async function settingsPage(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
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

  const user = await UserGetter.promises.getUser(userId)
  if (!user) {
    // The user has just deleted their account.
    return res.redirect('/logout')
  }
  const assignment = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'settings-page'
  )
  if (assignment.variant === 'react') {
    res.render('user/settings-react', {
      title: 'account_settings',
      user: {
        id: user.id,
        isAdmin: user.isAdmin,
        email: user.email,
        allowedFreeTrial: user.allowedFreeTrial,
        first_name: user.first_name,
        last_name: user.last_name,
        features: {
          dropbox: user.features.dropbox,
          github: user.features.github,
          mendeley: user.features.mendeley,
          zotero: user.features.zotero,
          references: user.features.references,
        },
        refProviders: {
          mendeley: user.refProviders?.mendeley,
          zotero: user.refProviders?.zotero,
        },
      },
      hasPassword: !!user.hashedPassword,
      shouldAllowEditingDetails,
      oauthProviders: UserPagesController._translateProviderDescriptions(
        oauthProviders,
        req
      ),
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
  } else {
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
  }
}

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

  settingsPage: expressify(settingsPage),

  sessionsPage(req, res, next) {
    const user = SessionManager.getSessionUser(req.session)
    logger.log({ userId: user._id }, 'loading sessions page')
    const currentSession = {
      ip_address: user.ip_address,
      session_created: user.session_created,
    }
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
          currentSession,
          sessions,
        })
      }
    )
  },

  emailPreferencesPage(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    UserGetter.getUser(userId, (err, user) => {
      if (err != null) {
        return next(err)
      }
      NewsletterManager.subscribed(user, (err, subscribed) => {
        if (err != null) {
          OError.tag(err, 'error getting newsletter subscription status')
          return next(err)
        }
        res.render('user/email-preferences', {
          title: 'newsletter_info_title',
          subscribed,
        })
      })
    })
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
