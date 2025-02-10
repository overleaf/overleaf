const app = require('../../../../app')
const settings = require('@overleaf/settings')

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
    app.listen(settings.internal.docstore.port, '127.0.0.1', error => {
      if (error != null) {
        throw error
      }
      this.running = true
      for (callback of Array.from(this.callbacks)) {
        callback()
      }
    })
  },
}
