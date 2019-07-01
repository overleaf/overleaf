/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const AuthenticationManager = require('./AuthenticationManager')
const LoginRateLimiter = require('../Security/LoginRateLimiter')
const UserUpdater = require('../User/UserUpdater')
const Metrics = require('metrics-sharelatex')
const logger = require('logger-sharelatex')
const querystring = require('querystring')
const Settings = require('settings-sharelatex')
const basicAuth = require('basic-auth-connect')
const UserHandler = require('../User/UserHandler')
const UserSessionsManager = require('../User/UserSessionsManager')
const Analytics = require('../Analytics/AnalyticsManager')
const passport = require('passport')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const SudoModeHandler = require('../SudoMode/SudoModeHandler')
const { URL } = require('url')

const AuthenticationController = (module.exports = {
  serializeUser(user, callback) {
    const lightUser = {
      _id: user._id,
      first_name: user.first_name,
      last_name: user.last_name,
      isAdmin: user.isAdmin,
      staffAccess: user.staffAccess,
      email: user.email,
      referal_id: user.referal_id,
      session_created: new Date().toISOString(),
      ip_address: user._login_req_ip,
      must_reconfirm: user.must_reconfirm,
      v1_id: user.overleaf != null ? user.overleaf.id : undefined
    }
    return callback(null, lightUser)
  },

  deserializeUser(user, cb) {
    return cb(null, user)
  },

  afterLoginSessionSetup(req, user, callback) {
    if (callback == null) {
      callback = function() {}
    }
    return req.login(user, function(err) {
      if (err != null) {
        logger.warn({ user_id: user._id, err }, 'error from req.login')
        return callback(err)
      }
      // Regenerate the session to get a new sessionID (cookie value) to
      // protect against session fixation attacks
      const oldSession = req.session
      return req.session.destroy(function(err) {
        if (err != null) {
          logger.warn(
            { user_id: user._id, err },
            'error when trying to destroy old session'
          )
          return callback(err)
        }
        req.sessionStore.generate(req)
        for (let key in oldSession) {
          const value = oldSession[key]
          if (key !== '__tmp') {
            req.session[key] = value
          }
        }
        // copy to the old `session.user` location, for backward-comptability
        req.session.user = req.session.passport.user
        return req.session.save(function(err) {
          if (err != null) {
            logger.warn(
              { user_id: user._id },
              'error saving regenerated session after login'
            )
            return callback(err)
          }
          UserSessionsManager.trackSession(user, req.sessionID, function() {})
          return callback(null)
        })
      })
    })
  },

  passportLogin(req, res, next) {
    // This function is middleware which wraps the passport.authenticate middleware,
    // so we can send back our custom `{message: {text: "", type: ""}}` responses on failure,
    // and send a `{redir: ""}` response on success
    return passport.authenticate('local', function(err, user, info) {
      if (err != null) {
        return next(err)
      }
      if (user) {
        // `user` is either a user object or false
        return AuthenticationController.finishLogin(user, req, res, next)
      } else {
        if (info.redir != null) {
          return res.json({ redir: info.redir })
        } else {
          return res.json({ message: info })
        }
      }
    })(req, res, next)
  },

  finishLogin(user, req, res, next) {
    if (user === false) {
      return res.redirect('/login')
    } // OAuth2 'state' mismatch
    if (user.must_reconfirm) {
      return AuthenticationController._redirectToReconfirmPage(req, res, user)
    } else {
      const redir =
        AuthenticationController._getRedirectFromSession(req) || '/project'
      AuthenticationController._loginAsyncHandlers(req, user)
      return AuthenticationController.afterLoginSessionSetup(
        req,
        user,
        function(err) {
          if (err != null) {
            return next(err)
          }
          return SudoModeHandler.activateSudoMode(user._id, function(err) {
            if (err != null) {
              logger.err(
                { err, user_id: user._id },
                'Error activating Sudo Mode on login, continuing'
              )
            }
            AuthenticationController._clearRedirectFromSession(req)
            if (
              __guard__(
                req.headers != null ? req.headers['accept'] : undefined,
                x => x.match(/^application\/json.*$/)
              )
            ) {
              return res.json({ redir })
            } else {
              return res.redirect(redir)
            }
          })
        }
      )
    }
  },

  doPassportLogin(req, username, password, done) {
    const email = username.toLowerCase()
    const Modules = require('../../infrastructure/Modules')
    return Modules.hooks.fire('preDoPassportLogin', req, email, function(
      err,
      infoList
    ) {
      if (err != null) {
        return done(err)
      }
      const info = infoList.find(i => i != null)
      if (info != null) {
        return done(null, false, info)
      }
      return LoginRateLimiter.processLoginRequest(email, function(
        err,
        isAllowed
      ) {
        if (err != null) {
          return done(err)
        }
        if (!isAllowed) {
          logger.log({ email }, 'too many login requests')
          return done(null, null, {
            text: req.i18n.translate('to_many_login_requests_2_mins'),
            type: 'error'
          })
        }
        return AuthenticationManager.authenticate({ email }, password, function(
          error,
          user
        ) {
          if (error != null) {
            return done(error)
          }
          if (user != null) {
            // async actions
            return done(null, user)
          } else {
            AuthenticationController._recordFailedLogin()
            logger.log({ email }, 'failed log in')
            return done(null, false, {
              text: req.i18n.translate('email_or_password_wrong_try_again'),
              type: 'error'
            })
          }
        })
      })
    })
  },

  _loginAsyncHandlers(req, user) {
    UserHandler.setupLoginData(user, function() {})
    LoginRateLimiter.recordSuccessfulLogin(user.email)
    AuthenticationController._recordSuccessfulLogin(user._id)
    AuthenticationController.ipMatchCheck(req, user)
    Analytics.recordEvent(user._id, 'user-logged-in', { ip: req.ip })
    Analytics.identifyUser(user._id, req.sessionID)
    logger.log(
      { email: user.email, user_id: user._id.toString() },
      'successful log in'
    )
    req.session.justLoggedIn = true
    // capture the request ip for use when creating the session
    return (user._login_req_ip = req.ip)
  },

  ipMatchCheck(req, user) {
    if (req.ip !== user.lastLoginIp) {
      NotificationsBuilder.ipMatcherAffiliation(user._id).create(req.ip)
    }
    return UserUpdater.updateUser(user._id.toString(), {
      $set: { lastLoginIp: req.ip }
    })
  },

  setInSessionUser(req, props) {
    return (() => {
      const result = []
      for (let key in props) {
        const value = props[key]
        if (
          __guard__(
            __guard__(req != null ? req.session : undefined, x1 => x1.passport),
            x => x.user
          ) != null
        ) {
          req.session.passport.user[key] = value
        }
        if (
          __guard__(req != null ? req.session : undefined, x2 => x2.user) !=
          null
        ) {
          result.push((req.session.user[key] = value))
        } else {
          result.push(undefined)
        }
      }
      return result
    })()
  },

  isUserLoggedIn(req) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    return ![null, undefined, false].includes(userId)
  },

  // TODO: perhaps should produce an error if the current user is not present
  getLoggedInUserId(req) {
    const user = AuthenticationController.getSessionUser(req)
    if (user) {
      return user._id
    } else {
      return null
    }
  },

  getLoggedInUserV1Id(req) {
    const user = AuthenticationController.getSessionUser(req)
    if ((user != null ? user.v1_id : undefined) != null) {
      return user.v1_id
    } else {
      return null
    }
  },

  getSessionUser(req) {
    if (__guard__(req != null ? req.session : undefined, x => x.user) != null) {
      return req.session.user
    } else if (
      __guard__(
        __guard__(req != null ? req.session : undefined, x2 => x2.passport),
        x1 => x1.user
      )
    ) {
      return req.session.passport.user
    } else {
      return null
    }
  },

  requireLogin() {
    const doRequest = function(req, res, next) {
      if (next == null) {
        next = function() {}
      }
      if (!AuthenticationController.isUserLoggedIn(req)) {
        return AuthenticationController._redirectToLoginOrRegisterPage(req, res)
      } else {
        req.user = AuthenticationController.getSessionUser(req)
        return next()
      }
    }

    return doRequest
  },

  requireOauth() {
    // require this here because module may not be included in some versions
    const Oauth2Server = require('../../../../modules/oauth2-server/app/src/Oauth2Server')
    return function(req, res, next) {
      if (next == null) {
        next = function() {}
      }
      const request = new Oauth2Server.Request(req)
      const response = new Oauth2Server.Response(res)
      return Oauth2Server.server.authenticate(request, response, {}, function(
        err,
        token
      ) {
        if (err != null) {
          // use a 401 status code for malformed header for git-bridge
          if (
            err.code === 400 &&
            err.message === 'Invalid request: malformed authorization header'
          ) {
            err.code = 401
          }
          // send all other errors
          return res
            .status(err.code)
            .json({ error: err.name, error_description: err.message })
        }
        req.oauth = { access_token: token.accessToken }
        req.oauth_token = token
        req.oauth_user = token.user
        return next()
      })
    }
  },

  _globalLoginWhitelist: [],
  addEndpointToLoginWhitelist(endpoint) {
    return AuthenticationController._globalLoginWhitelist.push(endpoint)
  },

  requireGlobalLogin(req, res, next) {
    if (
      Array.from(AuthenticationController._globalLoginWhitelist).includes(
        req._parsedUrl.pathname
      )
    ) {
      return next()
    }

    if (req.headers['authorization'] != null) {
      return AuthenticationController.httpAuth(req, res, next)
    } else if (AuthenticationController.isUserLoggedIn(req)) {
      return next()
    } else {
      logger.log(
        { url: req.url },
        'user trying to access endpoint not in global whitelist'
      )
      AuthenticationController.setRedirectInSession(req)
      return res.redirect('/login')
    }
  },

  httpAuth: basicAuth(function(user, pass) {
    const isValid = Settings.httpAuthUsers[user] === pass
    if (!isValid) {
      logger.err({ user, pass }, 'invalid login details')
    }
    return isValid
  }),

  setRedirectInSession(req, value) {
    if (value == null) {
      value =
        Object.keys(req.query).length > 0
          ? `${req.path}?${querystring.stringify(req.query)}`
          : `${req.path}`
    }
    if (
      req.session != null &&
      !/^\/(socket.io|js|stylesheets|img)\/.*$/.test(value) &&
      !/^.*\.(png|jpeg|svg)$/.test(value)
    ) {
      const safePath = AuthenticationController._getSafeRedirectPath(value)
      return (req.session.postLoginRedirect = safePath)
    }
  },

  _redirectToLoginOrRegisterPage(req, res) {
    if (
      req.query.zipUrl != null ||
      req.query.project_name != null ||
      req.path === '/user/subscription/new'
    ) {
      return AuthenticationController._redirectToRegisterPage(req, res)
    } else {
      return AuthenticationController._redirectToLoginPage(req, res)
    }
  },

  _redirectToLoginPage(req, res) {
    logger.log(
      { url: req.url },
      'user not logged in so redirecting to login page'
    )
    AuthenticationController.setRedirectInSession(req)
    const url = `/login?${querystring.stringify(req.query)}`
    res.redirect(url)
    return Metrics.inc('security.login-redirect')
  },

  _redirectToReconfirmPage(req, res, user) {
    logger.log(
      { url: req.url },
      'user needs to reconfirm so redirecting to reconfirm page'
    )
    req.session.reconfirm_email = user != null ? user.email : undefined
    const redir = '/user/reconfirm'
    if (
      __guard__(req.headers != null ? req.headers['accept'] : undefined, x =>
        x.match(/^application\/json.*$/)
      )
    ) {
      return res.json({ redir })
    } else {
      return res.redirect(redir)
    }
  },

  _redirectToRegisterPage(req, res) {
    logger.log(
      { url: req.url },
      'user not logged in so redirecting to register page'
    )
    AuthenticationController.setRedirectInSession(req)
    const url = `/register?${querystring.stringify(req.query)}`
    res.redirect(url)
    return Metrics.inc('security.login-redirect')
  },

  _recordSuccessfulLogin(userId, callback) {
    if (callback == null) {
      callback = function() {}
    }
    return UserUpdater.updateUser(
      userId.toString(),
      {
        $set: { lastLoggedIn: new Date() },
        $inc: { loginCount: 1 }
      },
      function(error) {
        if (error != null) {
          callback(error)
        }
        Metrics.inc('user.login.success')
        return callback()
      }
    )
  },

  _recordFailedLogin(callback) {
    Metrics.inc('user.login.failed')
    if (callback) callback()
  },

  _getRedirectFromSession(req) {
    let safePath
    const value = __guard__(
      req != null ? req.session : undefined,
      x => x.postLoginRedirect
    )
    if (value) {
      safePath = AuthenticationController._getSafeRedirectPath(value)
    }
    return safePath || null
  },

  _clearRedirectFromSession(req) {
    if (req.session != null) {
      return delete req.session.postLoginRedirect
    }
  },

  _getSafeRedirectPath(value) {
    const baseURL = Settings.siteUrl // base URL is required to construct URL from path
    const url = new URL(value, baseURL)
    let safePath = `${url.pathname}${url.search}${url.hash}`
    if (safePath === '/') {
      safePath = undefined
    }
    return safePath
  }
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
