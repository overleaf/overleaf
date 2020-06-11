const _ = require('lodash')
const Settings = require('settings-sharelatex')
const fs = require('fs')

const publicRegistrationModuleAvailable = fs.existsSync(
  `${__dirname}/../../../modules/public-registration`
)

const supportModuleAvailable = fs.existsSync(
  `${__dirname}/../../../modules/support`
)

const trackChangesModuleAvailable = fs.existsSync(
  `${__dirname}/../../../modules/track-changes`
)

const Features = {
  externalAuthenticationSystemUsed() {
    return (
      !!Settings.ldap ||
      !!Settings.saml ||
      !!_.get(Settings, ['overleaf', 'oauth'])
    )
  },

  hasFeature(feature) {
    switch (feature) {
      case 'homepage':
        return Settings.enableHomepage
      case 'registration':
        return !Features.externalAuthenticationSystemUsed() || Settings.overleaf
      case 'github-sync':
        return Settings.enableGithubSync
      case 'git-bridge':
        return Settings.enableGitBridge
      case 'custom-togglers':
        return !!Settings.overleaf
      case 'oauth':
        return !!Settings.oauth
      case 'templates-server-pro':
        return Settings.overleaf == null
      case 'affiliations':
      case 'analytics':
        // Checking both properties is needed for the time being to allow
        // enabling the feature in web-api and disabling in Server Pro
        // see https://github.com/overleaf/web-internal/pull/2127
        return Settings.apis && Settings.apis.v1 && !!Settings.apis.v1.url
      case 'overleaf-integration':
        return !!Settings.overleaf
      case 'references':
        return !!_.get(Settings, ['apis', 'references', 'url'])
      case 'saml':
        return Settings.enableSaml
      case 'link-url':
        return _.get(Settings, ['apis', 'linkedUrlProxy', 'url'])
      case 'public-registration':
        return publicRegistrationModuleAvailable
      case 'support':
        return supportModuleAvailable
      case 'track-changes':
        return trackChangesModuleAvailable
      default:
        throw new Error(`unknown feature: ${feature}`)
    }
  }
}

module.exports = Features
