const request = require('request')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const AuthenticationController = require('../Authentication/AuthenticationController')

const TEN_SECONDS = 1000 * 10

const languageCodeIsSupported = code =>
  Settings.languages.some(lang => lang.code === code)

module.exports = {
  proxyRequestToSpellingApi(req, res) {
    const { language } = req.body
    if (language && !languageCodeIsSupported(language)) {
      logger.warn(`language_code=${language} not supported`)
      return res.status(200).send(JSON.stringify({ misspellings: [] }))
    }

    const userId = AuthenticationController.getLoggedInUserId(req)
    let url = req.url.slice('/spelling'.length)
    url = `/user/${userId}${url}`
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
