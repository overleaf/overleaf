const logger = require('logger-sharelatex')

module.exports = {
  logRequest,
  logError
}

function logRequest(req, res) {
  // response has already been sent, but we log what happened here
  logger.log(
    {
      info: res.logInfo,
      url: req.originalUrl,
      params: req.params
    },
    res.logMsg || 'HTTP request'
  )
}

function logError(err, req, res, next) {
  logger.err(
    {
      err,
      info: res.logInfo,
      url: req.originalUrl,
      params: req.params,
      msg: res.logMsg
    },
    err.message
  )
  next(err) // use the standard error handler to send the response
}
