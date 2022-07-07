const { promisify } = require('util')
const OError = require('@overleaf/o-error')
const Lockfile = require('lockfile')
const Errors = require('./Errors')
const fsPromises = require('fs/promises')
const Path = require('path')

const LOCK_OPTS = {
  pollPeriod: 1000, // 1s between each test of the lock
  wait: 15000, // 15s maximum time to spend trying to get the lock
  stale: 5 * 60 * 1000, // 5 mins time until lock auto expires
}

const PromisifiedLockfile = {
  lock: promisify(Lockfile.lock),
  unlock: promisify(Lockfile.unlock),
}

async function acquire(path) {
  try {
    await PromisifiedLockfile.lock(path, LOCK_OPTS)
  } catch (err) {
    if (err.code === 'EEXIST') {
      throw new Errors.AlreadyCompilingError('compile in progress')
    } else {
      const dir = Path.dirname(path)
      const [statLock, statDir, readdirDir] = await Promise.allSettled([
        fsPromises.lstat(path),
        fsPromises.lstat(dir),
        fsPromises.readdir(dir),
      ])
      OError.tag(err, 'unable to get lock', {
        statLock: unwrapPromiseResult(statLock),
        statDir: unwrapPromiseResult(statDir),
        readdirDir: unwrapPromiseResult(readdirDir),
      })
      throw err
    }
  }
  return new Lock(path)
}

class Lock {
  constructor(path) {
    this._path = path
  }

  async release() {
    await PromisifiedLockfile.unlock(this._path)
  }
}

function unwrapPromiseResult(result) {
  if (result.status === 'fulfilled') {
    return result.value
  } else {
    return result.reason
  }
}

module.exports = { acquire }
