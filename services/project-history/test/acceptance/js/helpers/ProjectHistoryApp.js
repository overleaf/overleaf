// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { app } from '../../../../app/js/server.js'

let running = false
let initing = false
const callbacks = []

export function ensureRunning(callback) {
  if (callback == null) {
    callback = function () {}
  }
  if (running) {
    return callback()
  } else if (initing) {
    return callbacks.push(callback)
  }
  initing = true
  callbacks.push(callback)
  app.listen(3054, '127.0.0.1', error => {
    if (error != null) {
      throw error
    }
    running = true
    return (() => {
      const result = []
      for (callback of Array.from(callbacks)) {
        result.push(callback())
      }
      return result
    })()
  })
}
