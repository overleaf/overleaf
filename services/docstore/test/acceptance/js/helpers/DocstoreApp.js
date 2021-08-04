const app = require('../../../../app')
const { waitForDb } = require('../../../../app/js/mongodb')
require('logger-sharelatex').logger.level('error')
const settings = require('@overleaf/settings')

module.exports = {
  running: false,
  initing: false,
  callbacks: [],
  ensureRunning(callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    if (this.running) {
      return callback()
    } else if (this.initing) {
      return this.callbacks.push(callback)
    }
    this.initing = true
    this.callbacks.push(callback)
    waitForDb().then(() => {
      return app.listen(settings.internal.docstore.port, 'localhost', error => {
        if (error != null) {
          throw error
        }
        this.running = true
        return (() => {
          const result = []
          for (callback of Array.from(this.callbacks)) {
            result.push(callback())
          }
          return result
        })()
      })
    })
  },
}
