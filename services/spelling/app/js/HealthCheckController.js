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

      const misspellings =
        body && body.misspellings ? body.misspellings[0] : undefined
      const numberOfSuggestions =
        misspellings && misspellings.suggestions
          ? misspellings.suggestions.length
          : 0

      if (numberOfSuggestions > 10) {
        logger.log('health check passed')
        res.sendStatus(200)
      } else {
        logger.err({ body, numberOfSuggestions }, 'health check failed')
        res.sendStatus(500)
      }
    })
  }
}
