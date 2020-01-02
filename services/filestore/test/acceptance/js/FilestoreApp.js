const logger = require('logger-sharelatex')
const Settings = require('settings-sharelatex')
const fs = require('fs')
const Path = require('path')
const { promisify } = require('util')
const disrequire = require('disrequire')
const rp = require('request-promise-native').defaults({
  resolveWithFullResponse: true
})

const S3_TRIES = 30

logger.logger.level('info')

const fsReaddir = promisify(fs.readdir)
const sleep = promisify(setTimeout)

class FilestoreApp {
  constructor() {
    this.running = false
    this.initing = false
  }

  async runServer() {
    if (this.running) {
      return
    }

    if (this.initing) {
      return this.waitForInit()
    }
    this.initing = true

    this.app = await FilestoreApp.requireApp()

    await new Promise((resolve, reject) => {
      this.server = this.app.listen(
        Settings.internal.filestore.port,
        'localhost',
        err => {
          if (err) {
            return reject(err)
          }
          resolve()
        }
      )
    })

    if (Settings.filestore.backend === 's3') {
      try {
        await FilestoreApp.waitForS3()
      } catch (err) {
        await this.stop()
        throw err
      }
    }

    this.initing = false
  }

  async waitForInit() {
    while (this.initing) {
      await sleep(1000)
    }
  }

  async stop() {
    const closeServer = promisify(this.server.close).bind(this.server)
    try {
      await closeServer()
    } finally {
      delete this.server
    }
  }

  static async waitForS3() {
    let tries = 0
    if (!Settings.filestore.s3.endpoint) {
      return
    }

    let s3Available = false

    while (tries < S3_TRIES && !s3Available) {
      try {
        const response = await rp.get(`${Settings.filestore.s3.endpoint}/`)
        if ([200, 404].includes(response.statusCode)) {
          s3Available = true
        }
      } catch (err) {
        // swallow errors, as we may experience them until fake-s3 is running
      } finally {
        tries++
        if (!s3Available) {
          await sleep(1000)
        }
      }
    }
  }

  static async requireApp() {
    // unload the app, as we may be doing this on multiple runs with
    // different settings, which affect startup in some cases
    const files = await fsReaddir(Path.resolve(__dirname, '../../../app/js'))
    files.forEach(file => {
      disrequire(Path.resolve(__dirname, '../../../app/js', file))
    })
    disrequire(Path.resolve(__dirname, '../../../app'))

    return require('../../../app')
  }
}

module.exports = FilestoreApp
