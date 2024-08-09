const OError = require('@overleaf/o-error')

class UnprocessableError extends OError {}

class ApplyError extends UnprocessableError {
  constructor(message, operation, operand) {
    super(message)
    this.operation = operation
    this.operand = operand
  }
}

class InvalidInsertionError extends UnprocessableError {
  constructor(str, operation) {
    super('inserted text contains non BMP characters')
    this.str = str
    this.operation = operation
  }
}

class TooLongError extends UnprocessableError {
  constructor(operation, resultLength) {
    super('resulting string would be too long', { resultLength })
    this.operation = operation
    this.resultLength = resultLength
  }
}

module.exports = {
  UnprocessableError,
  ApplyError,
  InvalidInsertionError,
  TooLongError,
}
