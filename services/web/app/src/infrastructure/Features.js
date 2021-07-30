const _ = require('lodash')
const Settings = require('@overleaf/settings')

const publicRegistrationModuleAvailable = Settings.moduleImportSequence.includes(
  'public-registration'
)

const supportModuleAvailable = Settings.moduleImportSequence.includes('support')

const historyV1ModuleAvailable = Settings.moduleImportSequence.includes(
  'history-v1'
)

const trackChangesModuleAvailable = Settings.moduleImportSequence.includes(
  'track-changes'
)

/**
 * @typedef {Object} Settings
 * @property {Object | undefined}  apis
 * @property {Object | undefined}  apis.linkedUrlProxy
 * @property {string | undefined}  apis.linkedUrlProxy.url
 * @property {Object | undefined}  apis.references
 * @property {string | undefined}  apis.references.url
 * @property {boolean | undefined} enableGithubSync
 * @property {boolean | undefined} enableGitBridge
 * @property {boolean | undefined} enableHomepage
 * @property {boolean | undefined} enableSaml
 * @property {boolean | undefined} ldap
 * @property {boolean | undefined} oauth
 * @property {Object | undefined} overleaf
 * @property {Object | undefined} overleaf.oauth
 * @property {boolean | undefined} saml
 */

const Features = {
  /**
   * @returns {boolean}
   */
  externalAuthenticationSystemUsed() {
    return (
      (Boolean(Settings.ldap) && Boolean(Settings.ldap.enable)) ||
      (Boolean(Settings.saml) && Boolean(Settings.saml.enable)) ||
      Boolean(_.get(Settings, ['overleaf', 'oauth']))
    )
  },

  /**
   * Whether a feature is enabled in the appliation's configuration
   *
   * @param {string} feature
   * @returns {boolean}
   */
  hasFeature(feature) {
    switch (feature) {
      case 'saas':
        return Boolean(Settings.overleaf)
      case 'homepage':
        return Boolean(Settings.enableHomepage)
      case 'registration-page':
        return (
          !Features.externalAuthenticationSystemUsed() ||
          Boolean(Settings.overleaf)
        )
      case 'registration':
        return publicRegistrationModuleAvailable || Boolean(Settings.overleaf)
      case 'github-sync':
        return Boolean(Settings.enableGithubSync)
      case 'git-bridge':
        return Boolean(Settings.enableGitBridge)
      case 'custom-togglers':
        return Boolean(Settings.overleaf)
      case 'oauth':
        return Boolean(Settings.oauth)
      case 'templates-server-pro':
        return !Settings.overleaf
      case 'history-v1':
        return historyV1ModuleAvailable
      case 'affiliations':
      case 'analytics':
        return Boolean(_.get(Settings, ['apis', 'v1', 'url']))
      case 'overleaf-integration':
        return Boolean(Settings.overleaf)
      case 'references':
        return Boolean(_.get(Settings, ['apis', 'references', 'url']))
      case 'saml':
        return Boolean(Settings.enableSaml)
      case 'linked-project-file':
        return Boolean(Settings.enabledLinkedFileTypes.includes('project_file'))
      case 'linked-project-output-file':
        return Boolean(
          Settings.enabledLinkedFileTypes.includes('project_output_file')
        )
      case 'link-url':
        return Boolean(
          _.get(Settings, ['apis', 'linkedUrlProxy', 'url']) &&
            Settings.enabledLinkedFileTypes.includes('url')
        )
      case 'public-registration':
        return publicRegistrationModuleAvailable
      case 'support':
        return supportModuleAvailable
      case 'track-changes':
        return trackChangesModuleAvailable
      default:
        throw new Error(`unknown feature: ${feature}`)
    }
  },
}

module.exports = Features
