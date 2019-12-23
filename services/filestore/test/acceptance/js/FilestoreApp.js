const logger = require('logger-sharelatex')
const Settings = require('settings-sharelatex')
const fs = require('fs')
const Path = require('path')
const request = require('request')
const { promisify } = require('util')
const disrequire = require('disrequire')

const S3_TRIES = 30

logger.logger.level('info')

const fsReaddir = promisify(fs.readdir)

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
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  async stop() {
    if (this.server) {
      await new Promise(resolve => {
        this.server.close(resolve)
      })
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
        const response = await promisify(request.get)(
          `${Settings.filestore.s3.endpoint}/`
        )
        if ([200, 404].includes(response.statusCode)) {
          s3Available = true
        }
      } catch (err) {
      } finally {
        tries++
        if (!s3Available) {
          await new Promise(resolve => setTimeout(resolve, 1000))
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
