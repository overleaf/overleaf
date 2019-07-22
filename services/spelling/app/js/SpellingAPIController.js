const SpellingAPIManager = require('./SpellingAPIManager')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')

function extractCheckRequestData(req) {
  const token = req.params ? req.params.user_id : undefined
  const wordCount =
    req.body && req.body.words ? req.body.words.length : undefined
  return { token, wordCount }
}

function extractLearnRequestData(req) {
  const token = req.params ? req.params.user_id : undefined
  const word = req.body ? req.body.word : undefined
  return { token, word }
}

module.exports = {
  check(req, res) {
    metrics.inc('spelling-check', 0.1)
    const { token, wordCount } = extractCheckRequestData(req)
    logger.info({ token, wordCount }, 'running check')
    SpellingAPIManager.runRequest(token, req.body, function(error, result) {
      if (error != null) {
        logger.err(
          {
            err: error,
            user_id: token,
            wordCount
          },
          'error processing spelling request'
        )
        return res.sendStatus(500)
      }
      res.send(result)
    })
  },

  learn(req, res, next) {
    metrics.inc('spelling-learn', 0.1)
    const { token, word } = extractLearnRequestData(req)
    logger.info({ token, word }, 'learning word')
    SpellingAPIManager.learnWord(token, req.body, function(error) {
      if (error != null) {
        return next(error)
      }
      res.sendStatus(204)
    })
  },

  unlearn(req, res, next) {
    metrics.inc('spelling-unlearn', 0.1)
    const { token, word } = extractLearnRequestData(req)
    logger.info({ token, word }, 'unlearning word')
    SpellingAPIManager.unlearnWord(token, req.body, function(error) {
      if (error != null) {
        return next(error)
      }
      res.sendStatus(204)
    })
  },

  deleteDic(req, res, next) {
    const { token, word } = extractLearnRequestData(req)
    logger.log({ token, word }, 'deleting user dictionary')
    SpellingAPIManager.deleteDic(token, function(error) {
      if (error != null) {
        return next(error)
      }
      res.sendStatus(204)
    })
  },

  getDic(req, res, next) {
    const token = req.params ? req.params.user_id : undefined
    logger.info(
      {
        token
      },
      'getting user dictionary'
    )
    SpellingAPIManager.getDic(token, function(error, words) {
      if (error != null) {
        return next(error)
      }
      res.send(words)
    })
  }
}
