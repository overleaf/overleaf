let ErrorController
const Errors = require('./Errors')
const logger = require('logger-sharelatex')
const AuthenticationController = require('../Authentication/AuthenticationController')

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
    const user = AuthenticationController.getSessionUser(req)
    if (error.code === 'EBADCSRFTOKEN') {
      logger.warn(
        { err: error, url: req.url, method: req.method, user },
        'invalid csrf'
      )
      res.sendStatus(403)
    } else if (error instanceof Errors.NotFoundError) {
      logger.warn({ err: error, url: req.url }, 'not found error')
      ErrorController.notFound(req, res)
    } else if (error instanceof Errors.ForbiddenError) {
      logger.error({ err: error }, 'forbidden error')
      ErrorController.forbidden(req, res)
    } else if (error instanceof Errors.TooManyRequestsError) {
      logger.warn({ err: error, url: req.url }, 'too many requests error')
      res.sendStatus(429)
    } else if (error instanceof Errors.InvalidError) {
      logger.warn({ err: error, url: req.url }, 'invalid error')
      res.status(400)
      res.send(error.message)
    } else if (error instanceof Errors.InvalidNameError) {
      logger.warn({ err: error, url: req.url }, 'invalid name error')
      res.status(400)
      res.send(error.message)
    } else if (error instanceof Errors.SAMLSessionDataMissing) {
      logger.warn(
        { err: error, url: req.url },
        'missing SAML session data error'
      )
      res.status(400)
      res.send({ accountLinkingError: error.message })
    } else {
      logger.error(
        { err: error, url: req.url, method: req.method, user },
        'error passed to top level next middleware'
      )
      ErrorController.serverError(req, res)
    }
  },

  handleApiError(error, req, res, next) {
    if (error instanceof Errors.NotFoundError) {
      logger.warn({ err: error, url: req.url }, 'not found error')
      res.sendStatus(404)
    } else {
      logger.error(
        { err: error, url: req.url, method: req.method },
        'error passed to top level next middleware'
      )
      res.sendStatus(500)
    }
  }
}
