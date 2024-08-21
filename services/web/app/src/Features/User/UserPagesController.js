const UserGetter = require('./UserGetter')
const OError = require('@overleaf/o-error')
const UserSessionsManager = require('./UserSessionsManager')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const AuthenticationController = require('../Authentication/AuthenticationController')
const SessionManager = require('../Authentication/SessionManager')
const NewsletterManager = require('../Newsletter/NewsletterManager')
const SubscriptionLocator = require('../Subscription/SubscriptionLocator')
const _ = require('lodash')
const { expressify } = require('@overleaf/promise-utils')
const Features = require('../../infrastructure/Features')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')
const Modules = require('../../infrastructure/Modules')

async function settingsPage(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const reconfirmationRemoveEmail = req.query.remove
  // SSO
  const ssoError = req.session.ssoError
  if (ssoError) {
    delete req.session.ssoError
  }
  const ssoErrorMessage = req.session.ssoErrorMessage
  if (ssoErrorMessage) {
    delete req.session.ssoErrorMessage
  }
  const projectSyncSuccessMessage = req.session.projectSyncSuccessMessage
  if (projectSyncSuccessMessage) {
    delete req.session.projectSyncSuccessMessage
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
    return UserSessionsManager.removeSessionsFromRedis(
      { _id: userId },
      null,
      () => res.redirect('/')
    )
  }

  const showPersonalAccessToken =
    !Features.hasFeature('saas') || req.query?.personal_access_token === 'true'

  // if not already enabled, use a split test to determine whether to offer personal access tokens
  let optionalPersonalAccessToken = false
  if (!showPersonalAccessToken) {
    const { variant } = await SplitTestHandler.promises.getAssignment(
      req,
      res,
      'personal-access-token'
    )
    optionalPersonalAccessToken = variant === 'enabled' // `?personal-access-token=enabled`
  }

  // getAssignment sets res.locals, which will pass to the splitTest context
  await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'writefull-oauth-promotion'
  )

  let personalAccessTokens
  if (showPersonalAccessToken || optionalPersonalAccessToken) {
    try {
      // require this here because module may not be included in some versions
      const PersonalAccessTokenManager = require('../../../../modules/oauth2-server/app/src/OAuthPersonalAccessTokenManager')
      personalAccessTokens = await PersonalAccessTokenManager.listTokens(
        user._id
      )
    } catch (error) {
      logger.error(OError.tag(error))
    }
  }

  let currentManagedUserAdminEmail
  try {
    currentManagedUserAdminEmail =
      await SubscriptionLocator.promises.getAdminEmail(req.managedBy)
  } catch (err) {
    logger.error({ err }, 'error getting subscription admin email')
  }

  let memberOfSSOEnabledGroups = []
  try {
    memberOfSSOEnabledGroups =
      (
        await Modules.promises.hooks.fire(
          'getUserGroupsSSOEnrollmentStatus',
          user._id,
          { teamName: 1 },
          ['email']
        )
      )?.[0] || []
    memberOfSSOEnabledGroups = memberOfSSOEnabledGroups.map(group => {
      return {
        groupId: group._id.toString(),
        linked: group.linked,
        groupName: group.teamName,
        adminEmail: group.admin_id?.email,
      }
    })
  } catch (error) {
    logger.error(
      { err: error },
      'error fetching groups with Group SSO enabled the user may be member of'
    )
  }

  // Get the user's assignment for this page's Bootstrap 5 split test, which
  // populates splitTestVariants with a value for the split test name and allows
  // Pug to read it
  await SplitTestHandler.promises.getAssignment(req, res, 'bootstrap-5')

  res.render('user/settings', {
    title: 'account_settings',
    user: {
      id: user._id,
      isAdmin: user.isAdmin,
      email: user.email,
      allowedFreeTrial: user.allowedFreeTrial,
      first_name: user.first_name,
      last_name: user.last_name,
      alphaProgram: user.alphaProgram,
      betaProgram: user.betaProgram,
      labsProgram: user.labsProgram,
      features: {
        dropbox: user.features.dropbox,
        github: user.features.github,
        mendeley: user.features.mendeley,
        zotero: user.features.zotero,
        references: user.features.references,
      },
      refProviders: {
        mendeley: Boolean(user.refProviders?.mendeley),
        zotero: Boolean(user.refProviders?.zotero),
      },
      writefull: {
        enabled: Boolean(user.writefull?.enabled),
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
    ssoErrorMessage,
    thirdPartyIds: UserPagesController._restructureThirdPartyIds(user),
    projectSyncSuccessMessage,
    showPersonalAccessToken,
    optionalPersonalAccessToken,
    personalAccessTokens,
    emailAddressLimit: Settings.emailAddressLimit,
    isManagedAccount: !!req.managedBy,
    userRestrictions: Array.from(req.userRestrictions || []),
    currentManagedUserAdminEmail,
    gitBridgeEnabled: Settings.enableGitBridge,
    isSaas: Features.hasFeature('saas'),
    memberOfSSOEnabledGroups,
  })
}

async function accountSuspended(req, res) {
  if (SessionManager.isUserLoggedIn(req.session)) {
    return res.redirect('/project')
  }
  res.render('user/accountSuspended', {
    title: 'your_account_is_suspended',
  })
}

const UserPagesController = {
  accountSuspended: expressify(accountSuspended),

  registerPage(req, res) {
    const sharedProjectData = req.session.sharedProjectData || {}

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
      AuthenticationController.getRedirectFromSession(req) == null
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
    logger.debug({ userId: user._id }, 'loading sessions page')
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
    UserGetter.getUser(
      userId,
      { _id: 1, email: 1, first_name: 1, last_name: 1 },
      (err, user) => {
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
      }
    )
  },

  compromisedPasswordPage(_, res) {
    res.render('user/compromised_password')
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
