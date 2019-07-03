// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const request = require('request')
const logger = require('logger-sharelatex')
const settings = require('settings-sharelatex')

module.exports = {
  healthCheck(req, res) {
    const opts = {
      url: `http://localhost:3005/user/${settings.healthCheckUserId}/check`,
      json: {
        words: ['helllo'],
        language: 'en'
      },
      timeout: 1000 * 20
    }
    return request.post(opts, function(err, response, body) {
      if (err != null) {
        return res.sendStatus(500)
      }
      const numberOfSuggestions = __guard__(
        __guard__(
          __guard__(body != null ? body.misspellings : undefined, x2 => x2[0]),
          x1 => x1.suggestions
        ),
        x => x.length
      )
      if (numberOfSuggestions > 10) {
        logger.log('health check passed')
        return res.sendStatus(200)
      } else {
        logger.err({ body, numberOfSuggestions }, 'health check failed')
        return res.sendStatus(500)
      }
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
