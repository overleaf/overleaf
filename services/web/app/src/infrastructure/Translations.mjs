import i18n from 'i18next'
import fsBackend from 'i18next-fs-backend'
import middleware from 'i18next-http-middleware'
import path from 'node:path'
import Settings from '@overleaf/settings'
import { URL } from 'node:url'
import pug from 'pug-runtime'
import logger from '@overleaf/logger'
import SafeHTMLSubstitution from '../Features/Helpers/SafeHTMLSubstitution.mjs'

const fallbackLanguageCode = Settings.i18n.defaultLng || 'en'
const availableLanguageCodes = []
const availableHosts = new Map()
const subdomainConfigs = new Map()
const I18N_HTML_INJECTIONS = new Set()

Object.values(Settings.i18n.subdomainLang || {}).forEach(function (spec) {
  availableLanguageCodes.push(spec.lngCode)
  // prebuild a host->lngCode mapping for the usage at runtime in the
  //  middleware
  availableHosts.set(new URL(spec.url).host, spec.lngCode)

  // prebuild a lngCode -> language config mapping; some subdomains should
  //  not appear in the language picker
  if (!spec.hide) {
    subdomainConfigs.set(spec.lngCode, spec)
  }
})
if (!availableLanguageCodes.includes(fallbackLanguageCode)) {
  // always load the fallback locale
  availableLanguageCodes.push(fallbackLanguageCode)
}

// The "node --watch" flag is not easy to detect.
if (process.argv.includes('--watch-locales')) {
  // Dummy imports for setting up watching of locales files.
  for (const lngCode of availableLanguageCodes) {
    await import(`../../../locales/${lngCode}.json`, { with: { type: 'json' } })
  }
}

i18n
  .use(fsBackend)
  .use(middleware.LanguageDetector)
  .init({
    backend: {
      loadPath: path.join(import.meta.dirname, '../../../locales/__lng__.json'),
    },

    // still using the v3 plural suffixes
    compatibilityJSON: 'v3',

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
      escapeValue: Settings.i18n.escapeHTMLInVars,
      // Disable nesting in interpolated values, preventing user input
      // injection via another nested value
      skipOnVariables: true,

      defaultVariables: {
        appName: Settings.appName,
      },
    },

    preload: availableLanguageCodes,
    supportedLngs: availableLanguageCodes,
    fallbackLng: fallbackLanguageCode,
  })
  .catch(err => {
    logger.error({ err }, 'failed to initialize i18next library')
  })

// Make custom language detector for Accept-Language header
const headerLangDetector = new middleware.LanguageDetector(i18n.services, {
  order: ['header'],
})

function setLangBasedOnDomainMiddleware(req, res, next) {
  // Determine language from subdomain
  const lang = availableHosts.get(req.headers.host)
  if (lang) {
    req.i18n.changeLanguage(lang)
  }

  // expose the language code to pug
  res.locals.currentLngCode = req.language

  // If the set language is different from the language detection (based on
  // the Accept-Language header), then set flag which will show a banner
  // offering to switch to the appropriate library
  const detectedLanguageCode = headerLangDetector.detect(req, res)
  if (req.language !== detectedLanguageCode) {
    res.locals.suggestedLanguageSubdomainConfig =
      subdomainConfigs.get(detectedLanguageCode)
  }

  // Decorate req.i18n with translate function alias for backwards
  // compatibility usage in requests
  req.i18n.translate = (key, vars, components) => {
    vars = vars || {}

    if (Settings.i18n.checkForHTMLInVars) {
      Object.entries(vars).forEach(([field, value]) => {
        if (pug.escape(value) !== value) {
          const violationsKey = key + field
          // do not flood the logs, log one sample per pod + key + field
          if (!I18N_HTML_INJECTIONS.has(violationsKey)) {
            logger.warn(
              { key, field, value },
              'html content in translations context vars'
            )
            I18N_HTML_INJECTIONS.add(violationsKey)
          }
        }
      })
    }

    const locale = req.i18n.t(key, vars)
    if (components) {
      return SafeHTMLSubstitution.render(locale, components)
    } else {
      return locale
    }
  }

  next()
}

// Decorate i18n with translate function alias for backwards compatibility
// in direct usage
i18n.translate = i18n.t

export default {
  i18nMiddleware: middleware.handle(i18n),
  setLangBasedOnDomainMiddleware,
  i18n,
}
