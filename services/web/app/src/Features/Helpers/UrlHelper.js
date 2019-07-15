/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UrlHelper
const Settings = require('settings-sharelatex')

module.exports = UrlHelper = {
  wrapUrlWithProxy(url) {
    // TODO: Consider what to do for Community and Enterprise edition?
    if (!Settings.apis.linkedUrlProxy.url) {
      throw new Error('no linked url proxy configured')
    }
    return `${Settings.apis.linkedUrlProxy.url}?url=${encodeURIComponent(url)}`
  },

  prependHttpIfNeeded(url) {
    if (!url.match('://')) {
      url = `http://${url}`
    }
    return url
  }
}
