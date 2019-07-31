const logger = require('logger-sharelatex')
const OError = require('@overleaf/o-error')
const HttpErrors = require('@overleaf/o-error/http')
const AuthenticationController = require('../Authentication/AuthenticationController')

function renderHTMLError(statusCode, publicInfo, res) {
  res.status(statusCode)
  if (statusCode === 404) {
    res.render('general/404', { title: 'page_not_found' })
  } else if (statusCode === 403) {
    res.render('user/restricted')
  } else if (statusCode >= 400 && statusCode < 500) {
    res.render('general/500', { title: 'Client Error' })
  } else {
    res.render('general/500', { title: 'Server Error' })
  }
}

function renderJSONError(statusCode, publicInfo, res) {
  res.status(statusCode).json(publicInfo)
}

function renderError(error, req, res) {
  const publicInfo = OError.getFullInfo(error).public || {}

  switch (req.accepts(['html', 'json'])) {
    case 'html':
      renderHTMLError(error.statusCode, publicInfo, res)
      break
    case 'json':
      renderJSONError(error.statusCode, publicInfo, res)
      break
    default:
      res.sendStatus(error.statusCode)
  }
}

function logError(error, req) {
  const userId = AuthenticationController.getLoggedInUserId(req)

  let logLevel
  if (error.statusCode >= 400 && error.statusCode < 500) {
    logLevel = 'warn'
  } else {
    logLevel = 'error'
  }

  logger[logLevel]({ error, url: req.url, method: req.method, userId })
}

module.exports = {
  handleError(error, req, res, next) {
    // Only handles HttpErrors
    if (!(error instanceof HttpErrors.HttpError)) {
      return next(error)
    }

    logError(error, req)
    renderError(error, req, res)
  }
}
