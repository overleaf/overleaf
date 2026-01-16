import _ from 'lodash'
import Settings from '@overleaf/settings'

const supportModuleAvailable =
  Settings.moduleImportSequence?.includes('support')

const symbolPaletteModuleAvailable =
  Settings.moduleImportSequence?.includes('symbol-palette')

const trackChangesModuleAvailable =
  Settings.moduleImportSequence?.includes('track-changes')

/**
 * @typedef {Object} Settings
 * @property {Object | undefined}  apis
 * @property {Object | undefined}  apis.linkedUrlProxy
 * @property {string | undefined}  apis.linkedUrlProxy.url
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
      Boolean(Settings.overleaf)
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
        return Boolean(Settings.overleaf)
      case 'chat':
        return Boolean(Settings.disableChat) === false
      case 'link-sharing':
        return Boolean(Settings.disableLinkSharing) === false
      case 'github-sync':
        return Boolean(Settings.enableGithubSync)
      case 'git-bridge':
        return Boolean(Settings.enableGitBridge)
      case 'oauth':
        return Boolean(Settings.oauth)
      case 'templates-server-pro':
        return Boolean(Settings.templates?.user_id)
      case 'affiliations':
      case 'analytics':
        return Boolean(_.get(Settings, ['apis', 'v1', 'url']))
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
      case 'support':
        return supportModuleAvailable
      case 'symbol-palette':
        return symbolPaletteModuleAvailable
      case 'track-changes':
        return trackChangesModuleAvailable
      default:
        throw new Error(`unknown feature: ${feature}`)
    }
  },
}

export default Features
