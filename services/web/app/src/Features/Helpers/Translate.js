const Settings = require('@overleaf/settings')
const pug = require('pug-runtime')
const logger = require('@overleaf/logger')
const SafeHTMLSubstitute = require('./SafeHTMLSubstitution')
const I18N_HTML_INJECTIONS = new Set()

function translate(key, req, vars, components) {
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

  vars.appName = Settings.appName
  const locale = req.i18n.translate(key, vars)
  if (components) {
    return SafeHTMLSubstitute.render(locale, components)
  } else {
    return locale
  }
}
module.exports = { translate }
