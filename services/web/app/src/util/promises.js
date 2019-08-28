const { promisify } = require('util')

module.exports = { promisifyAll }

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
