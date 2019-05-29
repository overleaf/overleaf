/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let Features
const Settings = require('settings-sharelatex')

module.exports = Features = {
  externalAuthenticationSystemUsed() {
    return (
      Settings.ldap != null ||
      Settings.saml != null ||
      (Settings.overleaf != null ? Settings.overleaf.oauth : undefined) != null
    )
  },

  hasFeature(feature) {
    switch (feature) {
      case 'homepage':
        return Settings.enableHomepage
      case 'registration':
        return (
          !Features.externalAuthenticationSystemUsed() ||
          Settings.overleaf != null
        )
      case 'github-sync':
        return Settings.enableGithubSync
      case 'git-bridge':
        return Settings.enableGitBridge
      case 'v1-return-message':
        return (
          Settings.accountMerge != null &&
          Settings.overleaf != null &&
          !Settings.forceImportToV2
        )
      case 'custom-togglers':
        return Settings.overleaf != null
      case 'oauth':
        return Settings.oauth != null
      case 'publish-templates':
        return true
      case 'view-templates':
        return Settings.overleaf == null
      case 'affiliations':
        return (
          __guard__(
            __guard__(
              Settings != null ? Settings.apis : undefined,
              x1 => x1.v1
            ),
            x => x.url
          ) != null
        )
      case 'redirect-sl':
        return Settings.redirectToV2 != null
      case 'force-import-to-v2':
        return Settings.forceImportToV2
      default:
        throw new Error(`unknown feature: ${feature}`)
    }
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
