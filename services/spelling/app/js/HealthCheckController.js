import request from 'request'
import logger from '@overleaf/logger'
import settings from '@overleaf/settings'
import OError from '@overleaf/o-error'

export function healthCheck(req, res) {
  const opts = {
    url: `http://127.0.0.1:3005/user/${settings.healthCheckUserId}/check`,
    json: {
      words: ['helllo'],
      language: 'en',
    },
    timeout: 1000 * 20,
  }
  return request.post(opts, function (err, response, body) {
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
      logger.debug('health check passed')
      res.sendStatus(200)
    } else {
      logger.err(
        new OError('health check failed', { body, numberOfSuggestions })
      )
      res.sendStatus(500)
    }
  })
}
