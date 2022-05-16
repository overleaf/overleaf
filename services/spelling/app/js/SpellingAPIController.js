const SpellingAPIManager = require('./SpellingAPIManager')
const logger = require('@overleaf/logger')
const metrics = require('@overleaf/metrics')
const OError = require('@overleaf/o-error')

function extractCheckRequestData(req) {
  const token = req.params ? req.params.user_id : undefined
  const wordCount =
    req.body && req.body.words ? req.body.words.length : undefined
  return { token, wordCount }
}

module.exports = {
  check(req, res) {
    metrics.inc('spelling-check', 0.1)
    const { token, wordCount } = extractCheckRequestData(req)
    logger.debug({ token, wordCount }, 'running check')
    SpellingAPIManager.runRequest(token, req.body, function (error, result) {
      if (error != null) {
        logger.error(
          OError.tag(error, 'error processing spelling request', {
            user_id: token,
            wordCount,
          })
        )
        return res.sendStatus(500)
      }
      res.send(result)
    })
  },
}
