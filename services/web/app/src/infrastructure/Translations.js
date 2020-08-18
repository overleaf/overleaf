const i18n = require('i18next')
const fsBackend = require('i18next-fs-backend')
const middleware = require('i18next-http-middleware')
const path = require('path')
const Settings = require('settings-sharelatex')

const Translations = {
  setup(options = {}) {
    const subdomainLang = options.subdomainLang || {}
    const availableLngs = Object.values(subdomainLang).map(c => c.lngCode)

    i18n
      .use(fsBackend)
      .use(middleware.LanguageDetector)
      .init({
        backend: {
          loadPath: path.join(__dirname, '../../../locales/__lng__.json')
        },

        // Detect language set via setLng query string
        detection: {
          order: ['querystring'],
          lookupQuerystring: 'setLng'
        },

        // Load translation files synchronously: https://www.i18next.com/overview/configuration-options#initimmediate
        initImmediate: false,

        // We use the legacy v1 JSON format, so configure interpolator to use
        // underscores instead of curly braces
        interpolation: {
          prefix: '__',
          suffix: '__',
          unescapeSuffix: 'HTML',
          // Disable escaping of interpolated values for backwards compatibility.
          // We escape the value after it's translated in web, so there's no
          // security risk
          escapeValue: false,
          // Disable nesting in interpolated values, preventing user input
          // injection via another nested value
          skipOnVariables: true
        },

        preload: availableLngs,
        supportedLngs: availableLngs,
        fallbackLng: options.defaultLng || 'en'
      })

    // Make custom language detector for Accept-Language header
    const headerLangDetector = new middleware.LanguageDetector(i18n.services, {
      order: ['header']
    })

    function setLangBasedOnDomainMiddleware(req, res, next) {
      // setLng query param takes precedence, so if set ignore the subdomain
      if (req.originalUrl.includes('setLng')) {
        return next()
      }

      // Determine language from subdomain
      const { host } = req.headers
      if (host == null) {
        return next()
      }
      const [subdomain] = host.split(/[.-]/)
      const lang = subdomainLang[subdomain]
        ? subdomainLang[subdomain].lngCode
        : null

      if (lang != null) {
        req.i18n.changeLanguage(lang)
      }

      // If the set language is different from the language detection (based on
      // the Accept-Language header), then set flag which will show a banner
      // offering to switch to the appropriate library
      const detectedLanguage = headerLangDetector.detect(req, res)
      if (req.language !== detectedLanguage) {
        req.showUserOtherLng = detectedLanguage
      }

      next()
    }

    const expressMiddleware = function(req, res, next) {
      middleware.handle(i18n)(req, res, (...args) => {
        // Decorate req.i18n with translate function alias for backwards
        // compatibility usage in requests
        req.i18n.translate = req.i18n.t
        next(...args)
      })
    }

    // Decorate i18n with translate function alias for backwards compatibility
    // in direct usage
    i18n.translate = i18n.t

    return {
      expressMiddleware,
      setLangBasedOnDomainMiddleware,
      i18n,

      // Backwards compatibility with long-standing typo
      expressMiddlewear: expressMiddleware,
      setLangBasedOnDomainMiddlewear: setLangBasedOnDomainMiddleware
    }
  }
}

module.exports = Translations.setup(Settings.i18n)
