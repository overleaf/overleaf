const logger = require('@overleaf/logger')
const ObjectPersistor = require('@overleaf/object-persistor')
const Settings = require('@overleaf/settings')
const { promisify } = require('util')
const AWS = require('aws-sdk')
const App = require('../../../app')
const FileHandler = require('../../../app/js/FileHandler')

logger.logger.level('info')

const sleep = promisify(setTimeout)

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

    if (Settings.filestore.backend === 's3') {
      try {
        await FilestoreApp.waitForS3()
      } catch (err) {
        await this.stop()
        throw err
      }
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

  static async waitForS3() {
    let tries = 0
    if (!Settings.filestore.s3.endpoint) {
      return
    }

    const s3 = new AWS.S3({
      accessKeyId: Settings.filestore.s3.key,
      secretAccessKey: Settings.filestore.s3.secret,
      endpoint: Settings.filestore.s3.endpoint,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    })

    while (true) {
      try {
        return await s3
          .putObject({
            Key: 'startup',
            Body: '42',
            Bucket: Settings.filestore.stores.user_files,
          })
          .promise()
      } catch (err) {
        // swallow errors, as we may experience them until fake-s3 is running
        if (tries === 9) {
          // throw just before hitting the 10s test timeout
          throw err
        }
        tries++
        await sleep(1000)
      }
    }
  }
}

module.exports = FilestoreApp
