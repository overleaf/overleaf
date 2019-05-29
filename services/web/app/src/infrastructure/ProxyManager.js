/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ProxyManager
const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const request = require('request')
const URL = require('url')

module.exports = ProxyManager = {
  apply(publicApiRouter) {
    return (() => {
      const result = []
      for (var proxyUrl in settings.proxyUrls) {
        const target = settings.proxyUrls[proxyUrl]
        result.push(
          (function(target) {
            const method =
              (target.options != null ? target.options.method : undefined) ||
              'get'
            return publicApiRouter[method](
              proxyUrl,
              ProxyManager.createProxy(target)
            )
          })(target)
        )
      }
      return result
    })()
  },

  createProxy(target) {
    return function(req, res, next) {
      const targetUrl = makeTargetUrl(target, req)
      logger.log({ targetUrl, reqUrl: req.url }, 'proxying url')

      const options = { url: targetUrl }
      if (req.headers != null ? req.headers.cookie : undefined) {
        options.headers = { Cookie: req.headers.cookie }
      }
      if ((target != null ? target.options : undefined) != null) {
        Object.assign(options, target.options)
      }
      if (['post', 'put'].includes(options.method)) {
        options.form = req.body
      }
      const upstream = request(options)
      upstream.on('error', error =>
        logger.error({ err: error }, 'error in ProxyManager')
      )

      // TODO: better handling of status code
      // see https://github.com/overleaf/write_latex/wiki/Streams-and-pipes-in-Node.js
      return upstream.pipe(res)
    }
  }
}

// make a URL from a proxy target.
// if the query is specified, set/replace the target's query with the given query
var makeTargetUrl = function(target, req) {
  const targetUrl = URL.parse(parseSettingUrl(target, req))
  if (req.query != null && Object.keys(req.query).length > 0) {
    targetUrl.query = req.query
    targetUrl.search = null // clear `search` as it takes precedence over `query`
  }
  return targetUrl.format()
}

var parseSettingUrl = function(target, { params }) {
  let path
  if (typeof target === 'string') {
    return target
  }
  if (typeof target.path === 'function') {
    path = target.path(params)
  } else {
    ;({ path } = target)
  }
  return `${target.baseUrl}${path || ''}`
}
