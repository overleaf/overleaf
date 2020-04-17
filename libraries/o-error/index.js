'use strict'

/**
 * Make custom error types that pass `instanceof` checks, have stack traces,
 * support custom messages and properties, and support wrapping errors (causes).
 *
 * @module
 */

/**
 * A base class for custom errors that handles:
 *
 * 1. Wrapping an optional 'cause'.
 * 2. Storing an 'info' object with additional data.
 * 3. Setting the name to the subclass name.
 *
 * @extends Error
 */
class OError extends Error {
  /**
   * @param {string} message as for built-in Error
   * @param {?object} info extra data to attach to the error
   */
  constructor(message, info) {
    super(message)
    this.name = this.constructor.name
    if (info) {
      this.info = info
    }
  }

  /**
   * Wrap the given error, which caused this error.
   *
   * @param {Error} cause
   * @return {this}
   */
  withCause(cause) {
    this.cause = cause
    if (this.message && cause.message) {
      this.message += ': ' + cause.message
    }
    return this
  }
}

/**
 * Return the `info` property from `error` and recursively merge the `info`
 * properties from the error's causes, if any.
 *
 * If a property is repeated, the first one in the cause chain wins.
 *
 * @param {?Error} error assumed not to have circular causes
 * @return {Object}
 */
function getFullInfo(error) {
  if (!error) return {}
  const info = getFullInfo(error.cause)
  if (typeof error.info === 'object') Object.assign(info, error.info)
  return info
}

/**
 * Return the `stack` property from `error` and recursively append the `stack`
 * properties from the error's causes, if any.
 *
 * @param {?Error} error assumed not to have circular causes
 * @return {string}
 */
function getFullStack(error) {
  if (!error) return ''
  const causeStack = getFullStack(error.cause)
  if (causeStack) return error.stack + '\ncaused by: ' + causeStack
  return error.stack
}

/**
 * Is `error` or one of its causes an instance of `klass`?
 *
 * @param  {?Error} error assumed not to have circular causes
 * @param  {function} klass
 * @return {Boolean}
 */
function hasCauseInstanceOf(error, klass) {
  if (!error) return false
  return error instanceof klass || hasCauseInstanceOf(error.cause, klass)
}

OError.getFullInfo = getFullInfo
OError.getFullStack = getFullStack
OError.hasCauseInstanceOf = hasCauseInstanceOf

module.exports = OError
