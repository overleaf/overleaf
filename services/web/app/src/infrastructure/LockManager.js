const settings = require('@overleaf/settings')
const RedisWrapper = require('./RedisWrapper')
const rclient = RedisWrapper.client('lock')
const { callbackify, promisify } = require('util')

const RedisWebLocker = require('@overleaf/redis-wrapper/RedisWebLocker')

const LockManager = new RedisWebLocker({
  rclient,
  getKey(namespace, id) {
    return `lock:web:${namespace}:${id}`
  },
  options: settings.lockManager,
})

// need to bind the promisified function when it is part of a class
// see https://nodejs.org/dist/latest-v16.x/docs/api/util.html#utilpromisifyoriginal
const promisifiedRunWithLock = promisify(LockManager.runWithLock).bind(
  LockManager
)
LockManager.promises = {
  runWithLock(namespace, id, runner) {
    const cbRunner = callbackify(runner)
    return promisifiedRunWithLock(namespace, id, cbRunner)
  },
}

module.exports = LockManager
