const logger = require('@overleaf/logger')
const Metrics = require('@overleaf/metrics')
const Settings = require('@overleaf/settings')
const _ = require('lodash')
const { URL } = require('url')
const Path = require('path')
const moment = require('moment')
const { fetchJson } = require('@overleaf/fetch-utils')
const contentDisposition = require('content-disposition')
const Features = require('./Features')
const SessionManager = require('../Features/Authentication/SessionManager')
const PackageVersions = require('./PackageVersions')
const Modules = require('./Modules')
const Errors = require('../Features/Errors/Errors')
const {
  canRedirectToAdminDomain,
  hasAdminAccess,
} = require('../Features/Helpers/AdminAuthorizationHelper')
const {
  addOptionalCleanupHandlerAfterDrainingConnections,
} = require('./GracefulShutdown')

const IEEE_BRAND_ID = Settings.ieeeBrandId

let webpackManifest
function loadManifest() {
  switch (process.env.NODE_ENV) {
    case 'production':
      // Only load webpack manifest file in production.
      webpackManifest = require('../../../public/manifest.json')
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
}
function loadManifestFromWebpackDevServer(done = function () {}) {
  fetchJson(new URL(`/manifest.json`, Settings.apis.webpack.url), {
    headers: {
      Host: 'localhost',
    },
  })
    .then(json => {
      webpackManifest = json
      done()
    })
    .catch(error => {
      logger.err({ error }, 'cannot fetch webpack manifest')
      done(error)
    })
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
  loadManifest()
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

    let runtimeEmitted = false
    const runtimeChunk = webpackManifest['runtime.js']
    res.locals.entrypointScripts = function (entrypoint) {
      // Each "entrypoint" contains the runtime chunk as imports.
      // Loading the entrypoint twice results in broken execution.
      let chunks = getWebpackAssets(entrypoint, 'js')
      if (runtimeEmitted) {
        chunks = chunks.filter(chunk => chunk !== runtimeChunk)
      }
      runtimeEmitted = true
      return chunks.map(chunk => staticFilesBase + chunk)
    }

    res.locals.entrypointStyles = function (entrypoint) {
      const chunks = getWebpackAssets(entrypoint, 'css')
      return chunks.map(chunk => staticFilesBase + chunk)
    }

    res.locals.mathJaxPath = `/js/libs/mathjax-${PackageVersions.version.mathjax}/es5/tex-svg-full.js`
    res.locals.dictionariesRoot = `/js/dictionaries/${PackageVersions.version.dictionaries}/`

    res.locals.lib = PackageVersions.lib

    res.locals.moment = moment

    res.locals.isIEEE = brandId => brandId === IEEE_BRAND_ID

    res.locals.getCssThemeModifier = function (
      userSettings,
      brandVariation,
      enableIeeeBranding
    ) {
      // Themes only exist in OL v2
      if (Settings.overleaf != null) {
        // The IEEE theme is no longer applied in the editor, which sets
        // enableIeeeBranding to false, but is used in the IEEE portal. If
        // this is an IEEE-branded page and IEEE branding is disabled in this
        // page, always use the default theme (i.e. no light theme in the
        // IEEE-branded editor)
        if (res.locals.isIEEE(brandVariation?.brand_id)) {
          return enableIeeeBranding ? 'ieee-' : ''
        } else if (userSettings && userSettings.overallTheme != null) {
          return userSettings.overallTheme
        }
      }
      return ''
    }

    res.locals.buildStylesheetPath = function (cssFileName) {
      return staticFilesBase + webpackManifest[cssFileName]
    }

    res.locals.buildCssPath = function (
      themeModifier = '',
      bootstrapVersion = 3
    ) {
      // Pick which main stylesheet to use based on Bootstrap version
      return res.locals.buildStylesheetPath(
        bootstrapVersion === 5
          ? 'main-style-bootstrap-5.css'
          : `main-${themeModifier}style.css`
      )
    }

    res.locals.buildImgPath = function (imgFile) {
      const path = Path.join('/img/', imgFile)
      return staticFilesBase + path
    }

    next()
  })

  webRouter.use(function (req, res, next) {
    res.locals.translate = req.i18n.translate

    const addTranslatedTextDeep = obj => {
      if (_.isObject(obj)) {
        if (_.has(obj, 'text')) {
          obj.translatedText = req.i18n.translate(obj.text)
        }
        _.forOwn(obj, value => {
          addTranslatedTextDeep(value)
        })
      }
    }

    // This function is used to add translations from the server for main
    // navigation and footer items because it's tricky to get them in the front
    // end otherwise.
    res.locals.cloneAndTranslateText = obj => {
      const clone = _.cloneDeep(obj)
      addTranslatedTextDeep(clone)
      return clone
    }

    // Don't include the query string parameters, otherwise Google
    // treats ?nocdn=true as the canonical version
    try {
      const parsedOriginalUrl = new URL(req.originalUrl, Settings.siteUrl)
      res.locals.currentUrl = parsedOriginalUrl.pathname
      res.locals.currentUrlWithQueryParams =
        parsedOriginalUrl.pathname + parsedOriginalUrl.search
    } catch (err) {
      return next(new Errors.InvalidError())
    }
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
      Modules.loadViewIncludes(req.app)
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
    res.locals.bootstrap5Override =
      req.query['bootstrap-5-override'] === 'enabled'
    next()
  })

  webRouter.use(function (req, res, next) {
    res.locals.websiteRedesignOverride = req.query.redesign === 'enabled'
    next()
  })

  webRouter.use(function (req, res, next) {
    res.locals.ExposedSettings = {
      isOverleaf: Settings.overleaf != null,
      appName: Settings.appName,
      adminEmail: Settings.adminEmail,
      dropboxAppName:
        Settings.apis.thirdPartyDataStore?.dropboxAppName || 'Overleaf',
      ieeeBrandId: IEEE_BRAND_ID,
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
      projectUploadTimeout: Settings.projectUploadTimeout,
      recaptchaSiteKey: Settings.recaptcha?.siteKey,
      recaptchaSiteKeyV3: Settings.recaptcha?.siteKeyV3,
      recaptchaDisabled: Settings.recaptcha?.disabled,
      textExtensions: Settings.textExtensions,
      editableFilenames: Settings.editableFilenames,
      validRootDocExtensions: Settings.validRootDocExtensions,
      fileIgnorePattern: Settings.fileIgnorePattern,
      sentryAllowedOriginRegex: Settings.sentry.allowedOriginRegex,
      sentryDsn: Settings.sentry.publicDSN,
      sentryEnvironment: Settings.sentry.environment,
      sentryRelease: Settings.sentry.release,
      hotjarId: Settings.hotjar?.id,
      hotjarVersion: Settings.hotjar?.version,
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
      wikiEnabled: Settings.overleaf != null || Settings.proxyLearn,
      templatesEnabled:
        Settings.overleaf != null || Settings.templates?.user_id != null,
    }
    next()
  })
}
