import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import OError from '@overleaf/o-error'
import * as SpellingAPIManager from './SpellingAPIManager.js'

function extractCheckRequestData(req) {
  const token = req.params?.user_id
  const wordCount = req.body?.words?.length
  return { token, wordCount }
}

export function check(req, res) {
  metrics.inc('spelling-check', 0.1)
  const { token, wordCount } = extractCheckRequestData(req)
  logger.debug({ token, wordCount }, 'running check')
  SpellingAPIManager.runRequest(token, req.body, (error, result) => {
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
}
