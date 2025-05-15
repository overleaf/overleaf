// @ts-check

/**
 * Light-weight helpers for handling JavaScript Errors in node.js and the
 * browser.
 */
class OError extends Error {
  /**
   * The error that is the underlying cause of this error
   *
   * @type {unknown}
   */
  cause

  /**
   * List of errors encountered as the callback chain is unwound
   *
   * @type {TaggedError[] | undefined}
   */
  _oErrorTags

  /**
   * @param {string} message as for built-in Error
   * @param {Object} [info] extra data to attach to the error
   * @param {unknown} [cause] the internal error that caused this error
   */
  constructor(message, info, cause) {
    super(message)
    this.name = this.constructor.name
    if (info) this.info = info
    if (cause) this.cause = cause
  }

  /**
   * Set the extra info object for this error.
   *
   * @param {Object} info extra data to attach to the error
   * @return {this}
   */
  withInfo(info) {
    this.info = info
    return this
  }

  /**
   * Wrap the given error, which caused this error.
   *
   * @param {unknown} cause the internal error that caused this error
   * @return {this}
   */
  withCause(cause) {
    this.cause = cause
    return this
  }

  /**
   * Tag debugging information onto any error (whether an OError or not) and
   * return it.
   *
   * @example <caption>An error in a callback</caption>
   * function findUser(name, callback) {
   *   fs.readFile('/etc/passwd', (err, data) => {
   *     if (err) return callback(OError.tag(err, 'failed to read passwd'))
   *     // ...
   *   })
   * }
   *
   * @example <caption>A possible error in a callback</caption>
   * function cleanup(callback) {
   *   fs.unlink('/tmp/scratch', (err) => callback(err && OError.tag(err)))
   * }
   *
   * @example <caption>An error with async/await</caption>
   * async function cleanup() {
   *   try {
   *     await fs.promises.unlink('/tmp/scratch')
   *   } catch (err) {
   *     throw OError.tag(err, 'failed to remove scratch file')
   *   }
   * }
   *
   * @template {unknown} E
   * @param {E} error the error to tag
   * @param {string} [message] message with which to tag `error`
   * @param {Object} [info] extra data with wich to tag `error`
   * @return {E} the modified `error` argument
   */
  static tag(error, message, info) {
    const oError = /** @type {{ _oErrorTags: TaggedError[] | undefined }} */ (
      error
    )

    if (!oError._oErrorTags) oError._oErrorTags = []

    let tag
    if (Error.captureStackTrace) {
      // Hide this function in the stack trace, and avoid capturing it twice.
      tag = /** @type TaggedError */ ({ name: 'TaggedError', message, info })
      Error.captureStackTrace(tag, OError.tag)
    } else {
      tag = new TaggedError(message || '', info)
    }

    if (oError._oErrorTags.length >= OError.maxTags) {
      // Preserve the first tag and add an indicator that we dropped some tags.
      if (oError._oErrorTags[1] === DROPPED_TAGS_ERROR) {
        oError._oErrorTags.splice(2, 1)
      } else {
        oError._oErrorTags[1] = DROPPED_TAGS_ERROR
      }
    }
    oError._oErrorTags.push(tag)

    return error
  }

  /**
   * The merged info from any `tag`s and causes on the given error.
   *
   * If an info property is repeated, the last one wins.
   *
   * @param {unknown} error any error (may or may not be an `OError`)
   * @return {Object}
   */
  static getFullInfo(error) {
    const info = {}

    if (!error) return info

    const oError = /** @type{OError} */ (error)

    if (oError.cause) Object.assign(info, OError.getFullInfo(oError.cause))

    if (typeof oError.info === 'object') Object.assign(info, oError.info)

    if (oError._oErrorTags) {
      for (const tag of oError._oErrorTags) {
        Object.assign(info, tag.info)
      }
    }

    return info
  }

  /**
   * Return the `stack` property from `error`, including the `stack`s for any
   * tagged errors added with `OError.tag` and for any `cause`s.
   *
   * @param {unknown} error any error (may or may not be an `OError`)
   * @return {string}
   */
  static getFullStack(error) {
    if (!error) return ''

    const oError = /** @type{OError} */ (error)

    let stack = oError.stack || oError.message || '(no stack)'

    if (Array.isArray(oError._oErrorTags) && oError._oErrorTags.length) {
      stack += `\n${oError._oErrorTags.map(tag => tag.stack).join('\n')}`
    }

    const causeStack = OError.getFullStack(oError.cause)
    if (causeStack) {
      stack += '\ncaused by:\n' + indent(causeStack)
    }

    return stack
  }
}

/**
 * Maximum number of tags to apply to any one error instance. This is to avoid
 * a resource leak in the (hopefully unlikely) case that a singleton error
 * instance is returned to many callbacks. If tags have been dropped, the full
 * stack trace will include a placeholder tag `... dropped tags`.
 *
 * Defaults to 100. Must be at least 1.
 *
 * @type {Number}
 */
OError.maxTags = 100

/**
 * Used to record a stack trace every time we tag info onto an Error.
 *
 * @private
 * @extends OError
 */
class TaggedError extends OError {}

const DROPPED_TAGS_ERROR = /** @type{TaggedError} */ ({
  name: 'TaggedError',
  message: '... dropped tags',
  stack: 'TaggedError: ... dropped tags',
})

/**
 * @private
 * @param {string} string
 * @return {string}
 */
function indent(string) {
  return string.replace(/^/gm, '    ')
}

module.exports = OError
