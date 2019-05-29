/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ErrorController
const Errors = require('./Errors')
const logger = require('logger-sharelatex')
const AuthenticationController = require('../Authentication/AuthenticationController')

module.exports = ErrorController = {
  notFound(req, res) {
    res.status(404)
    return res.render('general/404', { title: 'page_not_found' })
  },

  forbidden(req, res) {
    res.status(403)
    return res.render('user/restricted')
  },

  serverError(req, res) {
    res.status(500)
    return res.render('general/500', { title: 'Server Error' })
  },

  accountMergeError(req, res) {
    res.status(500)
    return res.render('general/account-merge-error', {
      title: 'Account Access Error'
    })
  },

  handleError(error, req, res, next) {
    const user = AuthenticationController.getSessionUser(req)
    if ((error != null ? error.code : undefined) === 'EBADCSRFTOKEN') {
      logger.warn(
        { err: error, url: req.url, method: req.method, user },
        'invalid csrf'
      )
      res.sendStatus(403)
      return
    }
    if (error instanceof Errors.NotFoundError) {
      logger.warn({ err: error, url: req.url }, 'not found error')
      return ErrorController.notFound(req, res)
    } else if (error instanceof Errors.ForbiddenError) {
      logger.error({ err: error }, 'forbidden error')
      return ErrorController.forbidden(req, res)
    } else if (error instanceof Errors.TooManyRequestsError) {
      logger.warn({ err: error, url: req.url }, 'too many requests error')
      return res.sendStatus(429)
    } else if (error instanceof Errors.InvalidError) {
      logger.warn({ err: error, url: req.url }, 'invalid error')
      res.status(400)
      return res.send(error.message)
    } else if (error instanceof Errors.InvalidNameError) {
      logger.warn({ err: error, url: req.url }, 'invalid name error')
      res.status(400)
      return res.send(error.message)
    } else if (error instanceof Errors.AccountMergeError) {
      logger.error({ err: error }, 'account merge error')
      return ErrorController.accountMergeError(req, res)
    } else {
      logger.error(
        { err: error, url: req.url, method: req.method, user },
        'error passed to top level next middleware'
      )
      return ErrorController.serverError(req, res)
    }
  },

  handleApiError(error, req, res, next) {
    if (error instanceof Errors.NotFoundError) {
      logger.warn({ err: error, url: req.url }, 'not found error')
      return res.sendStatus(404)
    } else {
      logger.error(
        { err: error, url: req.url, method: req.method },
        'error passed to top level next middleware'
      )
      return res.sendStatus(500)
    }
  }
}
