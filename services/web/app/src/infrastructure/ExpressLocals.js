const logger = require('logger-sharelatex')
const fs = require('fs')
const crypto = require('crypto')
const Settings = require('settings-sharelatex')
const querystring = require('querystring')
const _ = require('lodash')
const Url = require('url')
const NodeHtmlEncoder = require('node-html-encoder').Encoder
const Path = require('path')
const moment = require('moment')
const chokidar = require('chokidar')

const Features = require('./Features')
const AuthenticationController = require('../Features/Authentication/AuthenticationController')
const PackageVersions = require('./PackageVersions')
const SystemMessageManager = require('../Features/SystemMessages/SystemMessageManager')
const Modules = require('./Modules')

const htmlEncoder = new NodeHtmlEncoder('numerical')

const jsPath = Settings.useMinifiedJs ? '/minjs/' : '/js/'

const webpackManifestPath = Path.join(
  __dirname,
  `../../../public${jsPath}manifest.json`
)
let webpackManifest
if (['development', 'test'].includes(process.env.NODE_ENV)) {
  // In dev the web and webpack containers can race (and therefore the manifest
  // file may not be created when web is running), so watch the file for changes
  // and reload
  webpackManifest = {}
  const reloadManifest = () => {
    logger.log('[DEV] Reloading webpack manifest')
    webpackManifest = require(webpackManifestPath)
  }

  logger.log('[DEV] Watching webpack manifest')
  chokidar
    .watch(webpackManifestPath)
    .on('add', reloadManifest)
    .on('change', reloadManifest)
} else {
  logger.log('[PRODUCTION] Loading webpack manifest')
  webpackManifest = require(webpackManifestPath)
}

function getFileContent(filePath) {
  filePath = Path.join(__dirname, '../../../', `public${filePath}`)
  const exists = fs.existsSync(filePath)
  if (exists) {
    const content = fs.readFileSync(filePath, 'UTF-8')
    return content
  } else {
    logger.log({ filePath }, 'file does not exist for hashing')
    return ''
  }
}

const pathList = [
  '/stylesheets/style.css',
  '/stylesheets/light-style.css',
  '/stylesheets/ieee-style.css',
  '/stylesheets/sl-style.css'
]
const hashedFiles = {}
if (!Settings.useMinifiedJs) {
  logger.log('not using minified JS, not hashing static files')
} else {
  logger.log('Generating file hashes...')
  for (let path of pathList) {
    const content = getFileContent(path)
    const hash = crypto
      .createHash('md5')
      .update(content)
      .digest('hex')

    const splitPath = path.split('/')
    const filenameSplit = splitPath.pop().split('.')
    filenameSplit.splice(filenameSplit.length - 1, 0, hash)
    splitPath.push(filenameSplit.join('.'))

    const hashPath = splitPath.join('/')
    hashedFiles[path] = hashPath

    const fsHashPath = Path.join(__dirname, '../../../', `public${hashPath}`)
    fs.writeFileSync(fsHashPath, content)

    logger.log('Finished hashing static content')
  }
}

module.exports = function(webRouter, privateApiRouter, publicApiRouter) {
  webRouter.use(function(req, res, next) {
    res.locals.session = req.session
    next()
  })

  function addSetContentDisposition(req, res, next) {
    res.setContentDisposition = function(type, opts) {
      const directives = _.map(
        opts,
        (v, k) => `${k}="${encodeURIComponent(v)}"`
      )
      const contentDispositionValue = `${type}; ${directives.join('; ')}`
      res.setHeader('Content-Disposition', contentDispositionValue)
    }
    next()
  }
  webRouter.use(addSetContentDisposition)
  privateApiRouter.use(addSetContentDisposition)
  publicApiRouter.use(addSetContentDisposition)

  webRouter.use(function(req, res, next) {
    req.externalAuthenticationSystemUsed =
      Features.externalAuthenticationSystemUsed
    res.locals.externalAuthenticationSystemUsed =
      Features.externalAuthenticationSystemUsed
    req.hasFeature = res.locals.hasFeature = Features.hasFeature
    next()
  })

  webRouter.use(function(req, res, next) {
    let staticFilesBase

    const cdnAvailable =
      Settings.cdn && Settings.cdn.web && !!Settings.cdn.web.host
    const cdnBlocked = req.query.nocdn === 'true' || req.session.cdnBlocked
    const userId = AuthenticationController.getLoggedInUserId(req)
    if (cdnBlocked && req.session.cdnBlocked == null) {
      logger.log(
        { user_id: userId, ip: req != null ? req.ip : undefined },
        'cdnBlocked for user, not using it and turning it off for future requets'
      )
      req.session.cdnBlocked = true
    }
    const host = req.headers && req.headers.host
    const isSmoke = host.slice(0, 5).toLowerCase() === 'smoke'
    if (cdnAvailable && !isSmoke && !cdnBlocked) {
      staticFilesBase = Settings.cdn.web.host
    } else {
      staticFilesBase = ''
    }

    res.locals.buildJsPath = function(jsFile, opts = {}) {
      // Resolve path from webpack manifest file
      let path = webpackManifest[jsFile]

      // HACK: If file can't be found within the webpack manifest, force url
      // to be relative to JS asset directory.
      // This should never happen in production, but it can happen in local
      // testing if webpack hasn't compiled
      if (!path) {
        path = Path.join(jsPath, jsFile)
      }

      if (opts.cdn !== false) {
        path = Url.resolve(staticFilesBase, path)
      }

      if (opts.qs) {
        path = path + '?' + querystring.stringify(opts.qs)
      }

      return path
    }

    res.locals.buildAssetsPath = function(path) {
      return `${jsPath}/${path}`
    }

    res.locals.mathJaxPath = res.locals.buildJsPath('libs/mathjax/MathJax.js', {
      cdn: false,
      qs: { config: 'TeX-AMS_HTML,Safe' }
    })

    res.locals.lib = PackageVersions.lib

    res.locals.moment = moment

    const IEEE_BRAND_ID = 15
    res.locals.isIEEE = brandVariation =>
      (brandVariation != null ? brandVariation.brand_id : undefined) ===
      IEEE_BRAND_ID

    const _buildCssFileName = themeModifier =>
      `/${Settings.brandPrefix}${themeModifier || ''}style.css`

    res.locals.getCssThemeModifier = function(userSettings, brandVariation) {
      // Themes only exist in OL v2
      let themeModifier
      if (Settings.overleaf != null) {
        // The IEEE theme takes precedence over the user personal setting, i.e. a user with
        // a theme setting of "light" will still get the IEE theme in IEEE branded projects.
        if (res.locals.isIEEE(brandVariation)) {
          themeModifier = 'ieee-'
        } else if (
          (userSettings != null ? userSettings.overallTheme : undefined) != null
        ) {
          themeModifier = userSettings.overallTheme
        }
      }
      return themeModifier
    }

    res.locals.buildCssPath = function(themeModifier, buildOpts) {
      const cssFileName = _buildCssFileName(themeModifier)
      const path = Path.join('/stylesheets/', cssFileName)
      if (
        (buildOpts != null ? buildOpts.hashedPath : undefined) &&
        hashedFiles[path] != null
      ) {
        const hashedPath = hashedFiles[path]
        return Url.resolve(staticFilesBase, hashedPath)
      }
      return Url.resolve(staticFilesBase, path)
    }

    res.locals.buildImgPath = function(imgFile) {
      const path = Path.join('/img/', imgFile)
      return Url.resolve(staticFilesBase, path)
    }

    next()
  })

  webRouter.use(function(req, res, next) {
    res.locals.translate = function(key, vars, htmlEncode) {
      if (vars == null) {
        vars = {}
      }
      if (htmlEncode == null) {
        htmlEncode = false
      }
      vars.appName = Settings.appName
      const str = req.i18n.translate(key, vars)
      if (htmlEncode) {
        return htmlEncoder.htmlEncode(str)
      } else {
        return str
      }
    }
    // Don't include the query string parameters, otherwise Google
    // treats ?nocdn=true as the canonical version
    res.locals.currentUrl = Url.parse(req.originalUrl).pathname
    res.locals.capitalize = function(string) {
      if (string.length === 0) {
        return ''
      }
      return string.charAt(0).toUpperCase() + string.slice(1)
    }
    next()
  })

  webRouter.use(function(req, res, next) {
    const subdomain = _.find(
      Settings.i18n.subdomainLang,
      subdomain => subdomain.lngCode === req.showUserOtherLng && !subdomain.hide
    )
    res.locals.recomendSubdomain = subdomain
    res.locals.currentLngCode = req.lng
    next()
  })

  webRouter.use(function(req, res, next) {
    res.locals.getUserEmail = function() {
      const user = AuthenticationController.getSessionUser(req)
      const email = (user != null ? user.email : undefined) || ''
      return email
    }
    next()
  })

  webRouter.use(function(req, res, next) {
    res.locals.StringHelper = require('../Features/Helpers/StringHelper')
    next()
  })

  webRouter.use(function(req, res, next) {
    res.locals.buildReferalUrl = function(referalMedium) {
      let url = Settings.siteUrl
      const currentUser = AuthenticationController.getSessionUser(req)
      if (
        currentUser != null &&
        (currentUser != null ? currentUser.referal_id : undefined) != null
      ) {
        url += `?r=${currentUser.referal_id}&rm=${referalMedium}&rs=b` // Referal source = bonus
      }
      return url
    }
    res.locals.getReferalId = function() {
      const currentUser = AuthenticationController.getSessionUser(req)
      if (
        currentUser != null &&
        (currentUser != null ? currentUser.referal_id : undefined) != null
      ) {
        return currentUser.referal_id
      }
    }
    next()
  })

  webRouter.use(function(req, res, next) {
    res.locals.csrfToken = req != null ? req.csrfToken() : undefined
    next()
  })

  webRouter.use(function(req, res, next) {
    res.locals.gaToken = Settings.analytics && Settings.analytics.ga.token
    next()
  })

  webRouter.use(function(req, res, next) {
    res.locals.getReqQueryParam = field =>
      req.query != null ? req.query[field] : undefined
    next()
  })

  webRouter.use(function(req, res, next) {
    const currentUser = AuthenticationController.getSessionUser(req)
    if (currentUser != null) {
      res.locals.user = {
        email: currentUser.email,
        first_name: currentUser.first_name,
        last_name: currentUser.last_name
      }
    }
    next()
  })

  webRouter.use(function(req, res, next) {
    res.locals.getLoggedInUserId = () =>
      AuthenticationController.getLoggedInUserId(req)
    res.locals.getSessionUser = () =>
      AuthenticationController.getSessionUser(req)
    next()
  })

  webRouter.use(function(req, res, next) {
    // Clone the nav settings so they can be modified for each request
    res.locals.nav = {}
    for (let key in Settings.nav) {
      res.locals.nav[key] = _.clone(Settings.nav[key])
    }
    res.locals.templates = Settings.templateLinks
    next()
  })

  webRouter.use((req, res, next) =>
    SystemMessageManager.getMessages(function(error, messages) {
      if (error) {
        return next(error)
      }
      if (messages == null) {
        messages = []
      }
      res.locals.systemMessages = messages
      next()
    })
  )

  webRouter.use(function(req, res, next) {
    if (Settings.reloadModuleViewsOnEachRequest) {
      Modules.loadViewIncludes()
    }
    res.locals.moduleIncludes = Modules.moduleIncludes
    res.locals.moduleIncludesAvailable = Modules.moduleIncludesAvailable
    next()
  })

  webRouter.use(function(req, res, next) {
    res.locals.uiConfig = {
      defaultResizerSizeOpen: 7,
      defaultResizerSizeClosed: 7,
      eastResizerCursor: 'ew-resize',
      westResizerCursor: 'ew-resize',
      chatResizerSizeOpen: 7,
      chatResizerSizeClosed: 0,
      chatMessageBorderSaturation: '85%',
      chatMessageBorderLightness: '40%',
      chatMessageBgSaturation: '85%',
      chatMessageBgLightness: '40%',
      defaultFontFamily: 'lucida',
      defaultLineHeight: 'normal',
      renderAnnouncements: false
    }
    next()
  })

  webRouter.use(function(req, res, next) {
    // TODO
    if (Settings.overleaf != null) {
      res.locals.overallThemes = [
        {
          name: 'Default',
          val: '',
          path: res.locals.buildCssPath(null, { hashedPath: true })
        },
        {
          name: 'Light',
          val: 'light-',
          path: res.locals.buildCssPath('light-', { hashedPath: true })
        }
      ]
    }
    next()
  })

  webRouter.use(function(req, res, next) {
    res.locals.settings = Settings
    next()
  })

  webRouter.use(function(req, res, next) {
    res.locals.ExposedSettings = {
      isOverleaf: Settings.overleaf != null,
      appName: Settings.appName,
      hasSamlBeta: req.session.samlBeta,
      hasSamlFeature: Features.hasFeature('saml'),
      samlInitPath: _.get(Settings, ['saml', 'ukamf', 'initPath']),
      siteUrl: Settings.siteUrl,
      recaptchaSiteKeyV3:
        Settings.recaptcha != null ? Settings.recaptcha.siteKeyV3 : undefined,
      recaptchaDisabled:
        Settings.recaptcha != null ? Settings.recaptcha.disabled : undefined,
      validRootDocExtensions: Settings.validRootDocExtensions
    }
    next()
  })
}
