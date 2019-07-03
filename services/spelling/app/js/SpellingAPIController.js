// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SpellingAPIManager = require('./SpellingAPIManager')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')

module.exports = {
  check(req, res, next) {
    metrics.inc('spelling-check', 0.1)
    logger.info(
      {
        token: __guard__(req != null ? req.params : undefined, x => x.user_id),
        word_count: __guard__(
          __guard__(req != null ? req.body : undefined, x2 => x2.words),
          x1 => x1.length
        )
      },
      'running check'
    )
    return SpellingAPIManager.runRequest(req.params.user_id, req.body, function(
      error,
      result
    ) {
      if (error != null) {
        logger.err(
          {
            err: error,
            user_id: __guard__(
              req != null ? req.params : undefined,
              x3 => x3.user_id
            ),
            word_count: __guard__(
              __guard__(req != null ? req.body : undefined, x5 => x5.words),
              x4 => x4.length
            )
          },
          'error processing spelling request'
        )
        return res.sendStatus(500)
      }
      return res.send(result)
    })
  },

  learn(req, res, next) {
    metrics.inc('spelling-learn', 0.1)
    logger.info(
      {
        token: __guard__(req != null ? req.params : undefined, x => x.user_id),
        word: __guard__(req != null ? req.body : undefined, x1 => x1.word)
      },
      'learning word'
    )
    return SpellingAPIManager.learnWord(req.params.user_id, req.body, function(
      error,
      result
    ) {
      if (error != null) {
        return next(error)
      }
      res.sendStatus(200)
      return next()
    })
  },

  deleteDic(req, res, next) {
    logger.log(
      {
        token: __guard__(req != null ? req.params : undefined, x => x.user_id),
        word: __guard__(req != null ? req.body : undefined, x1 => x1.word)
      },
      'deleting user dictionary'
    )
    return SpellingAPIManager.deleteDic(req.params.user_id, function(error) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(204)
    })
  },

  getDic(req, res, next) {
    logger.info(
      {
        token: __guard__(req != null ? req.params : undefined, x => x.user_id)
      },
      'getting user dictionary'
    )
    return SpellingAPIManager.getDic(req.params.user_id, function(
      error,
      words
    ) {
      if (error != null) {
        return next(error)
      }
      return res.send(words)
    })
  }
}
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
