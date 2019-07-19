const OError = require('@overleaf/o-error')

class HttpError extends OError {
  constructor(options) {
    super(options)
    this.statusCode = options.statusCode || 500
  }
}

class UnprocessableEntityError extends HttpError {
  constructor(options) {
    super({
      message: 'Unprocessable Entity',
      statusCode: 422,
      ...options
    })
  }
}

module.exports = {
  HttpError,
  UnprocessableEntityError
}
