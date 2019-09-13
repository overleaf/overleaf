/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
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
      case 'custom-togglers':
        return Settings.overleaf != null
      case 'oauth':
        return Settings.oauth != null
      case 'templates-server-pro':
        return Settings.overleaf == null
      case 'affiliations':
        // Checking both properties is needed for the time being to allow
        // enabling the feature in web-api and disabling in Server Pro
        // see https://github.com/overleaf/web-internal/pull/2127
        return Settings.apis.v1 && !!Settings.apis.v1.url
      case 'redirect-sl':
        return Settings.redirectToV2 != null
      case 'overleaf-integration':
        return Settings.overleaf != null
      case 'references':
        return Settings.apis.references.url != null
      case 'saml':
        return Settings.enableSaml != null
      default:
        throw new Error(`unknown feature: ${feature}`)
    }
  }
}
