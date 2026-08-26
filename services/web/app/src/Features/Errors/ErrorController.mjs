import { fromZodError } from 'zod-validation-error'
import {
  InvalidRequestError,
  InvalidParamsError,
} from '@overleaf/validation-tools'
import Errors, { NotFoundError } from './Errors.js'
import SessionManager from '../Authentication/SessionManager.mjs'
import SamlLogHandler from '../SamlLog/SamlLogHandler.mjs'
import HttpErrorHandler from './HttpErrorHandler.mjs'
import { plainTextResponse } from '../../infrastructure/Response.mjs'
import { expressifyErrorHandler } from '@overleaf/promise-utils'

// Keep in sync with the third-party-datastore service, which matches on this
// code: services/third-party-datastore/app/js/Dropbox/DropboxPoller.ts
// (_isWebOverLimitError).
const TOO_MANY_FILES_ERROR_CODE = 'project_has_too_many_files'

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
  } else if (error instanceof InvalidParamsError) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) {
      notFound(req, res)
    } else {
      // convert into a NotFoundError that the default handler understands
      return next(new NotFoundError('Not found').withCause(error))
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
  } else if (error instanceof InvalidRequestError) {
    req.logger.setLevel('warn')
    res.status(400)
    if (shouldSendErrorResponse) {
      const validationError = fromZodError(error.zodError)
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
  const shouldSendErrorResponse = !res.headersSent
  req.logger.addFields({ err })
  if (
    err instanceof Errors.NotFoundError ||
    err instanceof InvalidParamsError
  ) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) res.sendStatus(404)
  } else if (
    err instanceof URIError &&
    err.message.match(/^Failed to decode param/)
  ) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) res.sendStatus(400)
  } else if (err instanceof Errors.TooManyRequestsError) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) res.sendStatus(429)
  } else if (err instanceof Errors.ForbiddenError) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) res.sendStatus(403)
  } else if (err instanceof InvalidRequestError) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse) res.sendStatus(400)
  } else if (err instanceof Errors.TooManyFilesError) {
    req.logger.setLevel('warn')
    if (shouldSendErrorResponse)
      res.status(422).json({ code: TOO_MANY_FILES_ERROR_CODE })
  } else {
    req.logger.setLevel('error')
    if (shouldSendErrorResponse) res.sendStatus(500)
  }
}

export default {
  notFound,
  forbidden,
  serverError,
  handleError: expressifyErrorHandler(handleError),
  handleApiError,
}
