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
let BlogController
const request = require('request')
const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const _ = require('underscore')
const ErrorController = require('../Errors/ErrorController')

module.exports = BlogController = {
  getPage(req, res, next) {
    const url = req.url != null ? req.url.toLowerCase() : undefined
    const blogUrl = `${settings.apis.blog.url}${url}`

    const extensionsToProxy = [
      '.png',
      '.xml',
      '.jpeg',
      '.jpg',
      '.json',
      '.zip',
      '.eps',
      '.gif'
    ]

    const shouldProxy = _.find(
      extensionsToProxy,
      extension => url.indexOf(extension) !== -1
    )

    if (shouldProxy) {
      return BlogController._directProxy(blogUrl, res)
    }

    logger.log({ url }, 'proxying request to blog api')
    return request.get(blogUrl, function(err, r, data) {
      if (
        (r != null ? r.statusCode : undefined) === 404 ||
        (r != null ? r.statusCode : undefined) === 403
      ) {
        return ErrorController.notFound(req, res, next)
      }
      if (err != null) {
        return res.send(500)
      }
      data = data.trim()
      try {
        data = JSON.parse(data)
        if (settings.cdn && settings.cdn.web && settings.cdn.web.host) {
          if (data != null) {
            data.content = __guard__(
              data != null ? data.content : undefined,
              x1 =>
                x1.replace(
                  /src="(\/[^"]+)"/g,
                  `src='${settings.cdn.web.host}$1'`
                )
            )
          }
        }
      } catch (error) {
        err = error
        logger.err({ err, data }, 'error parsing data from data')
      }
      return res.render('blog/blog_holder', data)
    })
  },

  getIndexPage(req, res) {
    req.url = '/blog/index.html'
    return BlogController.getPage(req, res)
  },

  _directProxy(originUrl, res) {
    const upstream = request.get(originUrl)
    upstream.on('error', error =>
      logger.error({ err: error }, 'blog proxy error')
    )
    return upstream.pipe(res)
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
