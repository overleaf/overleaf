const ObjectPersistor = require('@overleaf/object-persistor')
const Settings = require('@overleaf/settings')
const { promisify } = require('node:util')
const App = require('../../../app')
const FileHandler = require('../../../app/js/FileHandler')

class FilestoreApp {
  async runServer() {
    if (!this.server) {
      await new Promise((resolve, reject) => {
        this.server = App.listen(
          Settings.internal.filestore.port,
          '127.0.0.1',
          err => {
            if (err) {
              return reject(err)
            }
            resolve()
          }
        )
      })
    }

    this.persistor = ObjectPersistor({
      ...Settings.filestore,
      paths: Settings.path,
    })
    FileHandler._TESTONLYSwapPersistorManager(this.persistor)
  }

  async stop() {
    if (!this.server) return
    const closeServer = promisify(this.server.close).bind(this.server)
    try {
      await closeServer()
    } finally {
      delete this.server
    }
  }
}

module.exports = FilestoreApp
