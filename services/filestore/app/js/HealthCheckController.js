const fs = require('node:fs')
const path = require('node:path')
const Settings = require('@overleaf/settings')
const { WritableBuffer } = require('@overleaf/stream-utils')
const { promisify } = require('node:util')
const Stream = require('node:stream')

const pipeline = promisify(Stream.pipeline)
const fsCopy = promisify(fs.copyFile)
const fsUnlink = promisify(fs.unlink)

const { HealthCheckError } = require('./Errors')
const FileConverter = require('./FileConverter').promises
const FileHandler = require('./FileHandler').promises

async function checkCanGetFiles() {
  if (!Settings.health_check) {
    return
  }

  const projectId = Settings.health_check.project_id
  const fileId = Settings.health_check.file_id
  const key = `${projectId}/${fileId}`
  const bucket = Settings.filestore.stores.user_files

  const buffer = new WritableBuffer({ initialSize: 100 })

  const sourceStream = await FileHandler.getFile(bucket, key, {})
  try {
    await pipeline(sourceStream, buffer)
  } catch (err) {
    throw new HealthCheckError('failed to get health-check file', {}, err)
  }

  if (!buffer.size()) {
    throw new HealthCheckError('no bytes written to download stream')
  }
}

async function checkFileConvert() {
  if (!Settings.enableConversions) {
    return
  }

  const imgPath = path.join(Settings.path.uploadFolder, '/tiny.pdf')

  let resultPath
  try {
    await fsCopy('./tiny.pdf', imgPath)
    resultPath = await FileConverter.thumbnail(imgPath)
  } finally {
    if (resultPath) {
      await fsUnlink(resultPath)
    }
    await fsUnlink(imgPath)
  }
}

module.exports = {
  check(req, res, next) {
    Promise.all([checkCanGetFiles(), checkFileConvert()])
      .then(() => res.sendStatus(200))
      .catch(err => {
        next(err)
      })
  },
}
