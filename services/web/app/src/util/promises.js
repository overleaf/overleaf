const { promisify } = require('util')
const pLimit = require('p-limit')

module.exports = {
  promisifyAll,
  expressify,
  promiseMapWithLimit
}

/**
 * Promisify all functions in a module.
 *
 * This is meant to be used only when all functions in the module are async
 * callback-style functions.
 *
 * It's very much tailored to our current module structure. In particular, it
 * binds `this` to the module when calling the function in order not to break
 * modules that call sibling functions using `this`.
 *
 * This will not magically fix all modules. Special cases should be promisified
 * manually.
 */
function promisifyAll(module, opts = {}) {
  const { without = [] } = opts
  const promises = {}
  for (const propName of Object.getOwnPropertyNames(module)) {
    if (without.includes(propName)) {
      continue
    }
    const propValue = module[propName]
    if (typeof propValue === 'function') {
      promises[propName] = promisify(propValue).bind(module)
    }
  }
  return promises
}

/**
 * Transform an async function into an Express middleware
 *
 * Any error will be passed to the error middlewares via `next()`
 */
function expressify(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}

/**
 * Map values in `array` with the async function `fn`
 *
 * Limit the number of unresolved promises to `concurrency`.
 */
function promiseMapWithLimit(concurrency, array, fn) {
  const limit = pLimit(concurrency)
  return Promise.all(array.map(x => limit(() => fn(x))))
}
