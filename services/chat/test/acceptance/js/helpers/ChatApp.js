const { waitForDb } = require('../../../../app/js/mongodb')
const app = require('../../../../app')

module.exports = {
  running: false,
  initing: false,
  callbacks: [],
  ensureRunning(callback) {
    if (this.running) {
      return callback()
    } else if (this.initing) {
      return this.callbacks.push(callback)
    }
    this.initing = true
    this.callbacks.push(callback)
    waitForDb().then(() => {
      app.listen(3010, 'localhost', error => {
        if (error) {
          throw error
        }
        this.running = true
        for (callback of this.callbacks) {
          callback()
        }
      })
    })
  },
}
