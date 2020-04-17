const OError = require('./index')

class HttpError extends OError {
  constructor(options) {
    super(options)
    this.statusCode = options.statusCode || 500
  }
}

class InternalServerError extends HttpError {
  constructor(options) {
    super({ message: 'Internal Server Error', statusCode: 500, ...options })
  }
}

class ServiceUnavailableError extends HttpError {
  constructor(options) {
    super({ message: 'Service Unavailable', statusCode: 503, ...options })
  }
}

class BadRequestError extends HttpError {
  constructor(options) {
    super({ message: 'Bad Request', statusCode: 400, ...options })
  }
}

class UnauthorizedError extends HttpError {
  constructor(options) {
    super({ message: 'Unauthorized', statusCode: 401, ...options })
  }
}

class ForbiddenError extends HttpError {
  constructor(options) {
    super({ message: 'Forbidden', statusCode: 403, ...options })
  }
}

class NotFoundError extends HttpError {
  constructor(options) {
    super({ message: 'Not Found', statusCode: 404, ...options })
  }
}

class MethodNotAllowedError extends HttpError {
  constructor(options) {
    super({ message: 'Method Not Allowed', statusCode: 405, ...options })
  }
}

class NotAcceptableError extends HttpError {
  constructor(options) {
    super({ message: 'Not Acceptable', statusCode: 406, ...options })
  }
}

class ConflictError extends HttpError {
  constructor(options) {
    super({ message: 'Conflict', statusCode: 409, ...options })
  }
}

class UnprocessableEntityError extends HttpError {
  constructor(options) {
    super({ message: 'Unprocessable Entity', statusCode: 422, ...options })
  }
}

class TooManyRequestsError extends HttpError {
  constructor(options) {
    super({ message: 'Too Many Requests', statusCode: 429, ...options })
  }
}

module.exports = {
  HttpError,
  InternalServerError,
  ServiceUnavailableError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  MethodNotAllowedError,
  NotAcceptableError,
  ConflictError,
  UnprocessableEntityError,
  TooManyRequestsError,
}
