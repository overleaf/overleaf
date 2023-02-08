let ErrorController
const Errors = require('./Errors')
const logger = require('@overleaf/logger')
const SessionManager = require('../Authentication/SessionManager')
const SamlLogHandler = require('../SamlLog/SamlLogHandler')
const HttpErrorHandler = require('./HttpErrorHandler')
const { plainTextResponse } = require('../../infrastructure/Response')

module.exports = ErrorController = {
  notFound(req, res) {
    res.status(404)
    res.render('general/404', { title: 'page_not_found' })
  },

  forbidden(req, res) {
    res.status(403)
    res.render('user/restricted')
  },

  serverError(req, res) {
    res.status(500)
    res.render('general/500', { title: 'Server Error' })
  },

  handleError(error, req, res, next) {
    const shouldSendErrorResponse = !res.headersSent
    const user = SessionManager.getSessionUser(req.session)
    // log errors related to SAML flow
    if (req.session && req.session.saml) {
      SamlLogHandler.log(req, { error })
    }
    if (error.code === 'EBADCSRFTOKEN') {
      logger.warn(
        { err: error, url: req.url, method: req.method, user },
        'invalid csrf'
      )
      if (shouldSendErrorResponse) {
        res.sendStatus(403)
      }
    } else if (error instanceof Errors.NotFoundError) {
      logger.warn({ err: error, url: req.url }, 'not found error')
      if (shouldSendErrorResponse) {
        ErrorController.notFound(req, res)
      }
    } else if (
      error instanceof URIError &&
      error.message.match(/^Failed to decode param/)
    ) {
      logger.warn({ err: error, url: req.url }, 'Express URIError')
      if (shouldSendErrorResponse) {
        res.status(400)
        res.render('general/500', { title: 'Invalid Error' })
      }
    } else if (error instanceof Errors.ForbiddenError) {
      logger.error({ err: error }, 'forbidden error')
      if (shouldSendErrorResponse) {
        ErrorController.forbidden(req, res)
      }
    } else if (error instanceof Errors.TooManyRequestsError) {
      logger.warn({ err: error, url: req.url }, 'too many requests error')
      if (shouldSendErrorResponse) {
        res.sendStatus(429)
      }
    } else if (error instanceof Errors.InvalidError) {
      logger.warn({ err: error, url: req.url }, 'invalid error')
      if (shouldSendErrorResponse) {
        res.status(400)
        plainTextResponse(res, error.message)
      }
    } else if (error instanceof Errors.InvalidNameError) {
      logger.warn({ err: error, url: req.url }, 'invalid name error')
      if (shouldSendErrorResponse) {
        res.status(400)
        plainTextResponse(res, error.message)
      }
    } else if (error instanceof Errors.SAMLSessionDataMissing) {
      logger.warn(
        { err: error, url: req.url },
        'missing SAML session data error'
      )
      if (shouldSendErrorResponse) {
        HttpErrorHandler.badRequest(req, res, error.message)
      }
    } else {
      logger.error(
        { err: error, url: req.url, method: req.method, user },
        'error passed to top level next middleware'
      )
      if (shouldSendErrorResponse) {
        ErrorController.serverError(req, res)
      }
    }
    if (!shouldSendErrorResponse) {
      // Pass the error to the default Express error handler, which will close
      // the connection.
      next(error)
    }
  },

  handleApiError(error, req, res, next) {
    if (error instanceof Errors.NotFoundError) {
      logger.warn({ err: error, url: req.url }, 'not found error')
      res.sendStatus(404)
    } else if (
      error instanceof URIError &&
      error.message.match(/^Failed to decode param/)
    ) {
      logger.warn({ err: error, url: req.url }, 'Express URIError')
      res.sendStatus(400)
    } else {
      logger.error(
        { err: error, url: req.url, method: req.method },
        'error passed to top level next middleware'
      )
      res.sendStatus(500)
    }
  },
}
