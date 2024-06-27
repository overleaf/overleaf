const request = require('request')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const SessionManager = require('../Authentication/SessionManager')
const LearnedWordsManager = require('./LearnedWordsManager')

const TEN_SECONDS = 1000 * 10

const languageCodeIsSupported = code =>
  Settings.languages.some(lang => lang.code === code)

module.exports = {
  learn(req, res, next) {
    const { word } = req.body
    const userId = SessionManager.getLoggedInUserId(req.session)
    LearnedWordsManager.learnWord(userId, word, err => {
      if (err) return next(err)
      res.sendStatus(204)
    })
  },

  unlearn(req, res, next) {
    const { word } = req.body
    const userId = SessionManager.getLoggedInUserId(req.session)
    LearnedWordsManager.unlearnWord(userId, word, err => {
      if (err) return next(err)
      res.sendStatus(204)
    })
  },

  proxyRequestToSpellingApi(req, res) {
    const { language } = req.body

    let url = req.url.slice('/spelling'.length)

    if (url === '/check') {
      if (!language) {
        logger.error(
          {},
          '"language" field should be included for spell checking'
        )
        return res.status(422).json({ misspellings: [] })
      }

      if (!languageCodeIsSupported(language)) {
        // this log statement can be changed to 'error' once projects with
        // unsupported languages are removed from the DB
        logger.debug({ language }, 'language not supported')
        return res.status(422).json({ misspellings: [] })
      }
    }

    const userId = SessionManager.getLoggedInUserId(req.session)
    url = `/user/${userId}${url}`
    req.headers.Host = Settings.apis.spelling.host
    return request({
      url: Settings.apis.spelling.url + url,
      method: req.method,
      headers: req.headers,
      json: req.body,
      timeout: TEN_SECONDS,
    })
      .on('error', function (error) {
        logger.error({ err: error }, 'Spelling API error')
        return res.status(500).end()
      })
      .pipe(res)
  },
}
