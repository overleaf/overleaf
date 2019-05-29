/* eslint-disable
    camelcase,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let SpellingController
const request = require('request')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const AuthenticationController = require('../Authentication/AuthenticationController')

const TEN_SECONDS = 1000 * 10

module.exports = SpellingController = {
  proxyRequestToSpellingApi(req, res, next) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    let url = req.url.slice('/spelling'.length)
    url = `/user/${user_id}${url}`
    req.headers['Host'] = Settings.apis.spelling.host
    return request({
      url: Settings.apis.spelling.url + url,
      method: req.method,
      headers: req.headers,
      json: req.body,
      timeout: TEN_SECONDS
    })
      .on('error', function(error) {
        logger.error({ err: error }, 'Spelling API error')
        return res.status(500).end()
      })
      .pipe(res)
  }
}
