const Settings = require('settings-sharelatex')
const { URL } = require('url')
const isDataUrl = require('valid-data-url')

function getSafeRedirectPath(value) {
  const baseURL = Settings.siteUrl // base URL is required to construct URL from path
  const url = new URL(value, baseURL)
  let safePath = `${url.pathname}${url.search}${url.hash}`.replace(/^\/+/, '/')
  if (safePath === '/') {
    safePath = undefined
  }
  return safePath
}

const UrlHelper = {
  getSafeRedirectPath,
  wrapUrlWithProxy(url) {
    // we already have the data for data URLs
    if (isDataUrl(url)) {
      return url
    }

    // TODO: Consider what to do for Community and Enterprise edition?
    if (!Settings.apis.linkedUrlProxy.url) {
      throw new Error('no linked url proxy configured')
    }
    return `${Settings.apis.linkedUrlProxy.url}?url=${encodeURIComponent(url)}`
  },

  prependHttpIfNeeded(url) {
    if (!url.match('://') && !isDataUrl(url)) {
      url = `http://${url}`
    }
    return url
  }
}

module.exports = UrlHelper
