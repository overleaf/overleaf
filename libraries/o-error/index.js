'use strict'

var util = require('util')

/**
 * Make custom error types that pass `instanceof` checks, have stack traces and
 * support custom messages and properties.
 * @module
 */

function extendErrorType (base, name, builder) {
  var errorConstructor = function () {
    Error.captureStackTrace && Error.captureStackTrace(this, this.constructor)
    if (builder) builder.apply(this, arguments)
    this.name = name
  }

  util.inherits(errorConstructor, base)

  errorConstructor.prototype.withCause = function (cause) {
    this.cause = cause
    if (this.message && cause.message) {
      this.message += ': ' + cause.message
    }
    return this
  }

  return errorConstructor
}

function defineErrorType (name, builder) {
  return extendErrorType(Error, name, builder)
}

function extendErrorTypeIn (container, base, name, builder) {
  container[name] = extendErrorType(base, name, builder)
}

function defineErrorTypeIn (container, name, builder) {
  extendErrorTypeIn(container, Error, name, builder)
}

exports.extend = extendErrorType
exports.define = defineErrorType
exports.extendIn = extendErrorTypeIn
exports.defineIn = defineErrorTypeIn
