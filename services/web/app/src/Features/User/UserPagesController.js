/* eslint-disable
    camelcase,
    max-len,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UserPagesController
const UserGetter = require('./UserGetter')
const UserSessionsManager = require('./UserSessionsManager')
const ErrorController = require('../Errors/ErrorController')
const logger = require('logger-sharelatex')
const Settings = require('settings-sharelatex')
const Errors = require('../Errors/Errors')
const request = require('request')
const fs = require('fs')
const AuthenticationController = require('../Authentication/AuthenticationController')

module.exports = UserPagesController = {
  registerPage(req, res) {
    const sharedProjectData = {
      project_name: req.query.project_name,
      user_first_name: req.query.user_first_name
    }

    const newTemplateData = {}
    if (req.session.templateData != null) {
      newTemplateData.templateName = req.session.templateData.templateName
    }

    return res.render('user/register', {
      title: 'register',
      sharedProjectData,
      newTemplateData,
      new_email: req.query.new_email || ''
    })
  },

  activateAccountPage(req, res) {
    // An 'activation' is actually just a password reset on an account that
    // was set with a random password originally.
    logger.log({ query: req.query }, 'activiate account page called')
    if (
      (req.query != null ? req.query.user_id : undefined) == null ||
      (req.query != null ? req.query.token : undefined) == null
    ) {
      return ErrorController.notFound(req, res)
    }

    return UserGetter.getUser(
      req.query.user_id,
      { email: 1, loginCount: 1 },
      function(error, user) {
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
          return res.redirect(`/login?email=${encodeURIComponent(user.email)}`)
        } else {
          return res.render('user/activate', {
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
    return res.render('user/login', {
      title: 'login',
      email: req.query.email
    })
  },

  logoutPage(req, res) {
    return res.render('user/logout')
  },

  renderReconfirmAccountPage(req, res) {
    const page_data = {
      reconfirm_email: __guard__(
        req != null ? req.session : undefined,
        x => x.reconfirm_email
      )
    }
    // when a user must reconfirm their account
    return res.render('user/reconfirm', page_data)
  },

  settingsPage(req, res, next) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    const ssoError = req.session.ssoError
    if (ssoError) {
      delete req.session.ssoError
    }
    logger.log({ user: user_id }, 'loading settings page')
    let shouldAllowEditingDetails = true
    if (Settings.ldap && Settings.ldap.updateUserDetailsOnLogin) {
      shouldAllowEditingDetails = false
    }
    if (Settings.saml && Settings.saml.updateUserDetailsOnLogin) {
      shouldAllowEditingDetails = false
    }
    const oauthProviders = Settings.oauthProviders || {}

    return UserGetter.getUser(user_id, function(err, user) {
      if (err != null) {
        return next(err)
      }

      return UserPagesController._hasPassword(user, function(
        err,
        passwordPresent
      ) {
        if (err) {
          logger.err({ err }, 'error getting password status from v1')
        }
        return res.render('user/settings', {
          title: 'account_settings',
          user,
          hasPassword: passwordPresent,
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
    })
  },

  sessionsPage(req, res, next) {
    const user = AuthenticationController.getSessionUser(req)
    logger.log({ user_id: user._id }, 'loading sessions page')
    return UserSessionsManager.getAllUserSessions(
      user,
      [req.sessionID],
      function(err, sessions) {
        if (err != null) {
          logger.warn({ user_id: user._id }, 'error getting all user sessions')
          return next(err)
        }
        return res.render('user/sessions', {
          title: 'sessions',
          sessions
        })
      }
    )
  },

  _hasPassword(user, callback) {
    return request.get(
      {
        url: `${Settings.apis.v1.url}/api/v1/sharelatex/has_password`,
        auth: { user: Settings.apis.v1.user, pass: Settings.apis.v1.pass },
        body: {
          user_id: __guard__(
            user != null ? user.overleaf : undefined,
            x => x.id
          )
        },
        timeout: 20 * 1000,
        json: true
      },
      function(err, response, body) {
        if (err) {
          // for errors assume password and show password setting form
          return callback(err, true)
        } else if (body != null ? body.has_password : undefined) {
          return callback(err, true)
        }
        return callback(err, false)
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
    return user.thirdPartyIdentifiers.reduce(function(obj, identifier) {
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
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
