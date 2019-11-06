/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const httpProxy = require('http-proxy')
const proxy = httpProxy.createProxyServer({
  target: settings.apis.realTime.url
})
const wsProxy = httpProxy.createProxyServer({
  target: settings.apis.realTime.url.replace('http://', 'ws://'),
  ws: true
})

proxy.on('error', function(error) {
  logger.err({ proxyError: error }, 'realtime http proxy error')
})
wsProxy.on('error', function(error) {
  logger.err({ proxyError: error }, 'realtime ws proxy error')
})

module.exports = {
  apply(webRouter, apiRouter) {
    webRouter.all(/\/socket\.io\/.*/, (req, res, next) =>
      proxy.web(req, res, next)
    )

    return setTimeout(function() {
      const Server = require('../../infrastructure/Server')
      return Server.server.on('upgrade', (req, socket, head) =>
        wsProxy.ws(req, socket, head)
      )
    }, 0)
  }
}
