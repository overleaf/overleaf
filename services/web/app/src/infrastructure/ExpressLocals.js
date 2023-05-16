const logger = require('@overleaf/logger')
const Metrics = require('@overleaf/metrics')
const Settings = require('@overleaf/settings')
const querystring = require('querystring')
const _ = require('lodash')
const { URL } = require('url')
const Path = require('path')
const moment = require('moment')
const request = require('request')
const contentDisposition = require('content-disposition')
const Features = require('./Features')
const SessionManager = require('../Features/Authentication/SessionManager')
const SplitTestMiddleware = require('../Features/SplitTests/SplitTestMiddleware')
const PackageVersions = require('./PackageVersions')
const Modules = require('./Modules')
const {
  canRedirectToAdminDomain,
  hasAdminAccess,
} = require('../Features/Helpers/AdminAuthorizationHelper')
const {
  addOptionalCleanupHandlerAfterDrainingConnections,
} = require('./GracefulShutdown')
const { expressify } = require('../util/promises')

const IEEE_BRAND_ID = Settings.ieeeBrandId

let webpackManifest
switch (process.env.NODE_ENV) {
  case 'production':
    // Only load webpack manifest file in production.
    webpackManifest = require(`../../../public/manifest.json`)
    break
  case 'development': {
    // In dev, fetch the manifest from the webpack container.
    loadManifestFromWebpackDevServer()
    const intervalHandle = setInterval(
      loadManifestFromWebpackDevServer,
      10 * 1000
    )
    addOptionalCleanupHandlerAfterDrainingConnections(
      'refresh webpack manifest',
      () => {
        clearInterval(intervalHandle)
      }
    )
    break
  }
  default:
    // In ci, all entries are undefined.
    webpackManifest = {}
}
function loadManifestFromWebpackDevServer(done = function () {}) {
  request(
    {
      uri: `${Settings.apis.webpack.url}/manifest.json`,
      headers: { Host: 'localhost' },
      json: true,
    },
    (err, res, body) => {
      if (!err && res.statusCode !== 200) {
        err = new Error(`webpack responded with statusCode: ${res.statusCode}`)
      }
      if (err) {
        logger.err({ err }, 'cannot fetch webpack manifest')
        return done(err)
      }
      webpackManifest = body
      done()
    }
  )
}
const IN_CI = process.env.NODE_ENV === 'test'
function getWebpackAssets(entrypoint, section) {
  if (IN_CI) {
    // Emit an empty list of entries in CI.
    return []
  }
  return webpackManifest.entrypoints[entrypoint].assets[section] || []
}

module.exports = function (webRouter, privateApiRouter, publicApiRouter) {
  webRouter.use(
    expressify(
      SplitTestMiddleware.loadAssignmentsInLocals([
        'design-system-updates',
        'features-page',
      ])
    )
  )

  if (process.env.NODE_ENV === 'development') {
    // In the dev-env, delay requests until we fetched the manifest once.
    webRouter.use(function (req, res, next) {
      if (!webpackManifest) {
        loadManifestFromWebpackDevServer(next)
      } else {
        next()
      }
    })
  }

  webRouter.use(function (req, res, next) {
    res.locals.session = req.session
    next()
  })

  function addSetContentDisposition(req, res, next) {
    res.setContentDisposition = function (type, { filename }) {
      res.setHeader(
        'Content-Disposition',
        contentDisposition(filename, { type })
      )
    }
    next()
  }
  webRouter.use(addSetContentDisposition)
  privateApiRouter.use(addSetContentDisposition)
  publicApiRouter.use(addSetContentDisposition)

  webRouter.use(function (req, res, next) {
    req.externalAuthenticationSystemUsed =
      Features.externalAuthenticationSystemUsed
    res.locals.externalAuthenticationSystemUsed =
      Features.externalAuthenticationSystemUsed
    req.hasFeature = res.locals.hasFeature = Features.hasFeature
    next()
  })

  webRouter.use(function (req, res, next) {
    let staticFilesBase

    const cdnAvailable =
      Settings.cdn && Settings.cdn.web && !!Settings.cdn.web.host
    const cdnBlocked =
      req.query.nocdn === 'true' || req.session.cdnBlocked || false
    const userId = SessionManager.getLoggedInUserId(req.session)
    if (cdnBlocked && req.session.cdnBlocked == null) {
      logger.debug(
        { userId, ip: req != null ? req.ip : undefined },
        'cdnBlocked for user, not using it and turning it off for future requets'
      )
      Metrics.inc('no_cdn', 1, {
        path: userId ? 'logged-in' : 'pre-login',
        method: 'true',
      })
      req.session.cdnBlocked = true
    }
    Metrics.inc('cdn_blocked', 1, {
      path: userId ? 'logged-in' : 'pre-login',
      method: String(cdnBlocked),
    })
    const host = req.headers && req.headers.host
    const isSmoke = host.slice(0, 5).toLowerCase() === 'smoke'
    if (cdnAvailable && !isSmoke && !cdnBlocked) {
      staticFilesBase = Settings.cdn.web.host
    } else {
      staticFilesBase = ''
    }

    res.locals.buildBaseAssetPath = function () {
      // Return the base asset path (including the CDN url) so that webpack can
      // use this to dynamically fetch scripts (e.g. PDFjs worker)
      return staticFilesBase + '/'
    }

    res.locals.buildJsPath = function (jsFile) {
      return staticFilesBase + webpackManifest[jsFile]
    }

    res.locals.buildCopiedJsAssetPath = function (jsFile) {
      return staticFilesBase + (webpackManifest[jsFile] || '/' + jsFile)
    }

    res.locals.entrypointScripts = function (entrypoint) {
      const chunks = getWebpackAssets(entrypoint, 'js')
      return chunks.map(chunk => staticFilesBase + chunk)
    }

    res.locals.entrypointStyles = function (entrypoint) {
      const chunks = getWebpackAssets(entrypoint, 'css')
      return chunks.map(chunk => staticFilesBase + chunk)
    }

    res.locals.mathJaxPath = `/js/libs/mathjax/MathJax.js?${querystring.stringify(
      {
        config: 'TeX-AMS_HTML,Safe',
        v: require('mathjax/package.json').version,
      }
    )}`

    res.locals.mathJax3Path = `/js/libs/mathjax3/es5/tex-svg-full.js?${querystring.stringify(
      {
        v: require('mathjax-3/package.json').version,
      }
    )}`

    res.locals.lib = PackageVersions.lib

    res.locals.moment = moment

    res.locals.isIEEE = brandVariation =>
      brandVariation?.brand_id === IEEE_BRAND_ID

    res.locals.getCssThemeModifier = function (userSettings, brandVariation) {
      // Themes only exist in OL v2
      if (Settings.overleaf != null) {
        // The IEEE theme takes precedence over the user personal setting, i.e. a user with
        // a theme setting of "light" will still get the IEE theme in IEEE branded projects.
        if (res.locals.isIEEE(brandVariation)) {
          return 'ieee-'
        } else if (userSettings && userSettings.overallTheme != null) {
          return userSettings.overallTheme
        }
      }
    }

    res.locals.buildStylesheetPath = function (cssFileName) {
      return staticFilesBase + webpackManifest[cssFileName]
    }

    res.locals.buildCssPath = function (themeModifier = '') {
      if (
        res.locals.splitTestVariants?.['design-system-updates'] === 'enabled'
      ) {
        themeModifier = `main-${themeModifier}`
      }
      return res.locals.buildStylesheetPath(`${themeModifier}style.css`)
    }

    res.locals.buildImgPath = function (imgFile) {
      const path = Path.join('/img/', imgFile)
      return staticFilesBase + path
    }

    next()
  })

  webRouter.use(function (req, res, next) {
    res.locals.translate = req.i18n.translate

    // Don't include the query string parameters, otherwise Google
    // treats ?nocdn=true as the canonical version
    const parsedOriginalUrl = new URL(req.originalUrl, Settings.siteUrl)
    res.locals.currentUrl = parsedOriginalUrl.pathname
    res.locals.currentUrlWithQueryParams =
      parsedOriginalUrl.pathname + parsedOriginalUrl.search
    res.locals.capitalize = function (string) {
      if (string.length === 0) {
        return ''
      }
      return string.charAt(0).toUpperCase() + string.slice(1)
    }
    next()
  })

  webRouter.use(function (req, res, next) {
    res.locals.getUserEmail = function () {
      const user = SessionManager.getSessionUser(req.session)
      const email = (user != null ? user.email : undefined) || ''
      return email
    }
    next()
  })

  webRouter.use(function (req, res, next) {
    res.locals.StringHelper = require('../Features/Helpers/StringHelper')
    next()
  })

  webRouter.use(function (req, res, next) {
    res.locals.buildReferalUrl = function (referalMedium) {
      let url = Settings.siteUrl
      const currentUser = SessionManager.getSessionUser(req.session)
      if (
        currentUser != null &&
        (currentUser != null ? currentUser.referal_id : undefined) != null
      ) {
        url += `?r=${currentUser.referal_id}&rm=${referalMedium}&rs=b` // Referal source = bonus
      }
      return url
    }
    res.locals.getReferalId = function () {
      const currentUser = SessionManager.getSessionUser(req.session)
      if (
        currentUser != null &&
        (currentUser != null ? currentUser.referal_id : undefined) != null
      ) {
        return currentUser.referal_id
      }
    }
    next()
  })

  webRouter.use(function (req, res, next) {
    res.locals.csrfToken = req != null ? req.csrfToken() : undefined
    next()
  })

  webRouter.use(function (req, res, next) {
    res.locals.getReqQueryParam = field =>
      req.query != null ? req.query[field] : undefined
    next()
  })

  webRouter.use(function (req, res, next) {
    const currentUser = SessionManager.getSessionUser(req.session)
    if (currentUser != null) {
      res.locals.user = {
        email: currentUser.email,
        first_name: currentUser.first_name,
        last_name: currentUser.last_name,
      }
    }
    next()
  })

  webRouter.use(function (req, res, next) {
    res.locals.getLoggedInUserId = () =>
      SessionManager.getLoggedInUserId(req.session)
    res.locals.getSessionUser = () => SessionManager.getSessionUser(req.session)
    res.locals.canRedirectToAdminDomain = () =>
      canRedirectToAdminDomain(SessionManager.getSessionUser(req.session))
    res.locals.hasAdminAccess = () =>
      hasAdminAccess(SessionManager.getSessionUser(req.session))
    next()
  })

  webRouter.use(function (req, res, next) {
    // Clone the nav settings so they can be modified for each request
    res.locals.nav = {}
    for (const key in Settings.nav) {
      res.locals.nav[key] = _.clone(Settings.nav[key])
    }
    res.locals.templates = Settings.templateLinks
    next()
  })

  webRouter.use(function (req, res, next) {
    if (Settings.reloadModuleViewsOnEachRequest) {
      Modules.loadViewIncludes()
    }
    res.locals.moduleIncludes = Modules.moduleIncludes
    res.locals.moduleIncludesAvailable = Modules.moduleIncludesAvailable
    next()
  })

  webRouter.use(function (req, res, next) {
    // TODO
    if (Settings.overleaf != null) {
      res.locals.overallThemes = [
        {
          name: 'Default',
          val: '',
          path: res.locals.buildCssPath(),
        },
        {
          name: 'Light',
          val: 'light-',
          path: res.locals.buildCssPath('light-'),
        },
      ]
    }
    next()
  })

  webRouter.use(function (req, res, next) {
    res.locals.settings = Settings
    next()
  })

  webRouter.use(function (req, res, next) {
    res.locals.showThinFooter = !Features.hasFeature('saas')
    next()
  })

  webRouter.use(function (req, res, next) {
    res.locals.ExposedSettings = {
      isOverleaf: Settings.overleaf != null,
      appName: Settings.appName,
      adminEmail: Settings.adminEmail,
      dropboxAppName:
        Settings.apis.thirdPartyDataStore?.dropboxAppName || 'Overleaf',
      hasSamlBeta: req.session.samlBeta,
      hasAffiliationsFeature: Features.hasFeature('affiliations'),
      hasSamlFeature: Features.hasFeature('saml'),
      samlInitPath: _.get(Settings, ['saml', 'ukamf', 'initPath']),
      hasLinkUrlFeature: Features.hasFeature('link-url'),
      hasLinkedProjectFileFeature: Features.hasFeature('linked-project-file'),
      hasLinkedProjectOutputFileFeature: Features.hasFeature(
        'linked-project-output-file'
      ),
      siteUrl: Settings.siteUrl,
      emailConfirmationDisabled: Settings.emailConfirmationDisabled,
      maxEntitiesPerProject: Settings.maxEntitiesPerProject,
      maxUploadSize: Settings.maxUploadSize,
      recaptchaSiteKeyV3:
        Settings.recaptcha != null ? Settings.recaptcha.siteKeyV3 : undefined,
      recaptchaDisabled:
        Settings.recaptcha != null ? Settings.recaptcha.disabled : undefined,
      textExtensions: Settings.textExtensions,
      validRootDocExtensions: Settings.validRootDocExtensions,
      sentryAllowedOriginRegex: Settings.sentry.allowedOriginRegex,
      sentryDsn: Settings.sentry.publicDSN,
      sentryEnvironment: Settings.sentry.environment,
      sentryRelease: Settings.sentry.release,
      enableSubscriptions: Settings.enableSubscriptions,
      gaToken:
        Settings.analytics &&
        Settings.analytics.ga &&
        Settings.analytics.ga.token,
      gaTokenV4:
        Settings.analytics &&
        Settings.analytics.ga &&
        Settings.analytics.ga.tokenV4,
      cookieDomain: Settings.cookieDomain,
      templateLinks: Settings.templateLinks,
      labsEnabled: Settings.labs && Settings.labs.enable,
    }
    next()
  })
}
