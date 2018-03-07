'use strict'

var util = require('util')

/**
 * Make custom error types. There are many, many modules for this, but they all
 * seem a bit weird. This approach is based on
 * https://gist.github.com/justmoon/15511f92e5216fa2624b
 * which seems sensible. This module mainly tries to DRY it up a bit. It also
 * incorporates some ideas from the verror package. Maybe it can become its own
 * package one day.
 *
 * TODO: Will this work under browserify?
 *
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
