const { promisify } = require('util')
const pLimit = require('p-limit')

module.exports = {
  promisifyAll,
  promisifyMultiResult,
  callbackifyMultiResult,
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
 *
 * The second argument is a bag of options:
 *
 * - without: an array of function names that shouldn't be promisified
 *
 * - multiResult: an object whose keys are function names and values are lists
 *   of parameter names. This is meant for functions that invoke their callbacks
 *   with more than one result in separate parameters. The promisifed function
 *   will return these results as a single object, with each result keyed under
 *   the corresponding parameter name.
 */
function promisifyAll(module, opts = {}) {
  const { without = [], multiResult = {} } = opts
  const promises = {}
  for (const propName of Object.getOwnPropertyNames(module)) {
    if (without.includes(propName)) {
      continue
    }
    const propValue = module[propName]
    if (typeof propValue !== 'function') {
      continue
    }
    if (multiResult[propName] != null) {
      promises[propName] = promisifyMultiResult(
        propValue,
        multiResult[propName]
      ).bind(module)
    } else {
      promises[propName] = promisify(propValue).bind(module)
    }
  }
  return promises
}

/**
 * Promisify a function that returns multiple results via additional callback
 * parameters.
 *
 * The promisified function returns the results in a single object whose keys
 * are the names given in the array `resultNames`.
 *
 * Example:
 *
 *     function f(callback) {
 *       return callback(null, 1, 2, 3)
 *     }
 *
 *     const g = promisifyMultiResult(f, ['a', 'b', 'c'])
 *
 *     const result = await g()  // returns {a: 1, b: 2, c: 3}
 */
function promisifyMultiResult(fn, resultNames) {
  function promisified(...args) {
    return new Promise((resolve, reject) => {
      try {
        fn(...args, (err, ...results) => {
          if (err != null) {
            return reject(err)
          }
          const promiseResult = {}
          for (let i = 0; i < resultNames.length; i++) {
            promiseResult[resultNames[i]] = results[i]
          }
          resolve(promiseResult)
        })
      } catch (err) {
        reject(err)
      }
    })
  }
  return promisified
}

/**
 * Reverse the effect of `promisifyMultiResult`.
 *
 * This is meant for providing a temporary backward compatible callback
 * interface while we migrate to promises.
 */
function callbackifyMultiResult(fn, resultNames) {
  function callbackified(...args) {
    const [callback] = args.splice(-1)
    fn(...args)
      .then(result => {
        const cbResults = resultNames.map(resultName => result[resultName])
        callback(null, ...cbResults)
      })
      .catch(err => {
        callback(err)
      })
  }
  return callbackified
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
