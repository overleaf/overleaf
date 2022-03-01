// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const app = require('../../../../app')
require('@overleaf/logger').logger.level('info')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')

module.exports = {
  running: false,
  initing: false,
  callbacks: [],
  ensureRunning(callback) {
    if (callback == null) {
      callback = function () {}
    }
    if (this.running) {
      return callback()
    } else if (this.initing) {
      return this.callbacks.push(callback)
    } else {
      this.initing = true
      this.callbacks.push(callback)
      return app.listen(
        __guard__(
          Settings.internal != null ? Settings.internal.clsi : undefined,
          x => x.port
        ),
        'localhost',
        error => {
          if (error != null) {
            throw error
          }
          this.running = true
          logger.log('clsi running in dev mode')

          return (() => {
            const result = []
            for (callback of Array.from(this.callbacks)) {
              result.push(callback())
            }
            return result
          })()
        }
      )
    }
  },
}
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
