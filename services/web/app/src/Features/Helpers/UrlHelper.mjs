import Settings from '@overleaf/settings'
import { URL } from 'node:url'

const PROTO = new URL(Settings.siteUrl).protocol

function getCanonicalURL(req, url) {
  const origin = `${PROTO}//${req.headers.host}`
  url = new URL(url || req.originalUrl, origin)
  if (url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }
  url.search = ''
  url.hash = ''
  return url.href
}

function getSafeRedirectPath(value) {
  const baseURL = Settings.siteUrl // base URL is required to construct URL from path
  const url = new URL(value, baseURL)
  let safePath = `${url.pathname}${url.search}${url.hash}`.replace(/^\/+/, '/')
  if (safePath === '/') {
    safePath = undefined
  }
  return safePath
}

function getSafeAdminDomainRedirect(path) {
  return Settings.adminUrl + (getSafeRedirectPath(path) || '/')
}

export default {
  getCanonicalURL,
  getSafeRedirectPath,
  getSafeAdminDomainRedirect,
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
  },
}
