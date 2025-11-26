import { isZodErrorLike, fromZodError } from 'zod-validation-error'
import Errors from './Errors.js'
import SessionManager from '../Authentication/SessionManager.mjs'
import SamlLogHandler from '../SamlLog/SamlLogHandler.mjs'
import HttpErrorHandler from './HttpErrorHandler.mjs'
import { plainTextResponse } from '../../infrastructure/Response.mjs'
import { expressifyErrorHandler } from '@overleaf/promise-utils'

function notFound(req, res) {
  res.status(404)
  res.render('general/404', { title: 'page_not_found' })
}

function forbidden(req, res) {
  res.status(403)
  res.render('user/restricted')
}

function serverError(req, res) {
  res.status(500)
  res.render('general/500', { title: 'Server Error' })
}

async function handleError(error, req, res, next) {
  const shouldSendErrorResponse = !res.headersSent
  const user = SessionManager.getSessionUser(req.session)
  req.logger.addFields({ err: error })
  // log errors related to SAML flow
  if (req.session && req.session.saml) {
    req.logger.setLevel('error')
    await SamlLogHandler.promises.log(req, { error })
  }
  if (error.code === 'EBADCSRFTOKEN') {
    req.logger.addFields({ user })
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) {
      res.sendStatus(403)
    }
  } else if (error instanceof Errors.NotFoundError) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) {
      notFound(req, res)
    }
  } else if (
    error instanceof URIError &&
    error.message.match(/^Failed to decode param/)
  ) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) {
      res.status(400)
      res.render('general/500', { title: 'Invalid Error' })
    }
  } else if (error instanceof Errors.ForbiddenError) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) {
      forbidden(req, res)
    }
  } else if (error instanceof Errors.TooManyRequestsError) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) {
      res.sendStatus(429)
    }
  } else if (error instanceof Errors.InvalidError) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) {
      res.status(400)
      plainTextResponse(res, error.message)
    }
  } else if (error instanceof Errors.DuplicateNameError) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) {
      res.status(400)
      plainTextResponse(res, error.message)
    }
  } else if (error instanceof Errors.InvalidNameError) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) {
      res.status(400)
      plainTextResponse(res, error.message)
    }
  } else if (error instanceof Errors.NonDeletableEntityError) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) {
      res.status(422)
      plainTextResponse(res, error.message)
    }
  } else if (error instanceof Errors.SAMLSessionDataMissing) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) {
      HttpErrorHandler.badRequest(req, res, error.message)
    }
  } else if (error instanceof Errors.FileTooLargeError) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) {
      res.status(400)
      plainTextResponse(res, error.message)
    }
  } else if (isZodErrorLike(error)) {
    req.logger.setLevel('warn')
    res.status(400)
    if (shouldSendErrorResponse) {
      const validationError = fromZodError(error)
      res.render('general/400', { message: validationError.message })
    }
  } else {
    req.logger.setLevel('error')
    if (shouldSendErrorResponse) {
      serverError(req, res)
    }
  }
  if (!shouldSendErrorResponse) {
    // Pass the error to the default Express error handler, which will close
    // the connection.
    next(error)
  }
}

function handleApiError(err, req, res, next) {
  req.logger.addFields({ err })
  if (err instanceof Errors.NotFoundError) {
    req.logger.setLevel('warn')
    res.sendStatus(404)
  } else if (
    err instanceof URIError &&
    err.message.match(/^Failed to decode param/)
  ) {
    req.logger.setLevel('warn')
    res.sendStatus(400)
  } else if (err instanceof Errors.TooManyRequestsError) {
    req.logger.setLevel('warn')
    res.sendStatus(429)
  } else if (err instanceof Errors.ForbiddenError) {
    req.logger.setLevel('warn')
    res.sendStatus(403)
  } else if (isZodErrorLike(err)) {
    req.logger.setLevel('warn')
    res.sendStatus(400)
  } else {
    req.logger.setLevel('error')
    res.sendStatus(500)
  }
}

export default {
  notFound,
  forbidden,
  serverError,
  handleError: expressifyErrorHandler(handleError),
  handleApiError,
}
