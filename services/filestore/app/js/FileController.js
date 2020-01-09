const PersistorManager = require('./PersistorManager')
const logger = require('logger-sharelatex')
const FileHandler = require('./FileHandler')
const metrics = require('metrics-sharelatex')
const parseRange = require('range-parser')
const Errors = require('./Errors')
const { pipeline } = require('stream')

const maxSizeInBytes = 1024 * 1024 * 1024 // 1GB

module.exports = {
  getFile,
  getFileHead,
  insertFile,
  copyFile,
  deleteFile,
  directorySize
}

function getFile(req, res, next) {
  const { key, bucket } = req
  const { format, style } = req.query
  const options = {
    key,
    bucket,
    format,
    style
  }
  metrics.inc('getFile')
  logger.log({ key, bucket, format, style }, 'receiving request to get file')

  if (req.headers.range) {
    const range = _getRange(req.headers.range)
    if (range) {
      options.start = range.start
      options.end = range.end
      logger.log(
        { start: range.start, end: range.end },
        'getting range of bytes from file'
      )
    }
  }

  FileHandler.getFile(bucket, key, options, function(err, fileStream) {
    if (err) {
      if (err instanceof Errors.NotFoundError) {
        res.sendStatus(404)
      } else {
        logger.err({ err, key, bucket, format, style }, 'problem getting file')
        res.sendStatus(500)
      }
      return
    }

    if (req.query.cacheWarm) {
      logger.log(
        { key, bucket, format, style },
        'request is only for cache warm so not sending stream'
      )
      return res.sendStatus(200)
    }

    logger.log({ key, bucket, format, style }, 'sending file to response')

    pipeline(fileStream, res, err => {
      if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        logger.err(
          new Errors.ReadError({
            message: 'error transferring stream',
            info: { bucket, key, format, style }
          }).withCause(err)
        )
      }
    })
  })
}

function getFileHead(req, res) {
  const { key, bucket } = req
  metrics.inc('getFileSize')
  logger.log({ key, bucket }, 'receiving request to get file metadata')
  FileHandler.getFileSize(bucket, key, function(err, fileSize) {
    if (err) {
      if (err instanceof Errors.NotFoundError) {
        res.sendStatus(404)
      } else {
        res.sendStatus(500)
      }
      return
    }
    res.set('Content-Length', fileSize)
    res.status(200).end()
  })
}

function insertFile(req, res) {
  metrics.inc('insertFile')
  const { key, bucket } = req
  logger.log({ key, bucket }, 'receiving request to insert file')
  FileHandler.insertFile(bucket, key, req, function(err) {
    if (err) {
      logger.log({ err, key, bucket }, 'error inserting file')
      res.sendStatus(500)
    } else {
      res.sendStatus(200)
    }
  })
}

function copyFile(req, res) {
  metrics.inc('copyFile')
  const { key, bucket } = req
  const oldProjectId = req.body.source.project_id
  const oldFileId = req.body.source.file_id
  logger.log(
    { key, bucket, oldProject_id: oldProjectId, oldFile_id: oldFileId },
    'receiving request to copy file'
  )

  PersistorManager.copyFile(
    bucket,
    `${oldProjectId}/${oldFileId}`,
    key,
    function(err) {
      if (err) {
        if (err instanceof Errors.NotFoundError) {
          res.sendStatus(404)
        } else {
          logger.log(
            { err, oldProject_id: oldProjectId, oldFile_id: oldFileId },
            'something went wrong copying file'
          )
          res.sendStatus(500)
        }
        return
      }

      res.sendStatus(200)
    }
  )
}

function deleteFile(req, res) {
  metrics.inc('deleteFile')
  const { key, bucket } = req
  logger.log({ key, bucket }, 'receiving request to delete file')
  return FileHandler.deleteFile(bucket, key, function(err) {
    if (err != null) {
      logger.log({ err, key, bucket }, 'something went wrong deleting file')
      return res.sendStatus(500)
    } else {
      return res.sendStatus(204)
    }
  })
}

function directorySize(req, res) {
  metrics.inc('projectSize')
  const { project_id: projectId, bucket } = req
  logger.log({ projectId, bucket }, 'receiving request to project size')
  FileHandler.getDirectorySize(bucket, projectId, function(err, size) {
    if (err) {
      logger.log({ err, projectId, bucket }, 'error inserting file')
      return res.sendStatus(500)
    }

    res.json({ 'total bytes': size })
  })
}

function _getRange(header) {
  const parsed = parseRange(maxSizeInBytes, header)
  if (parsed === -1 || parsed === -2 || parsed.type !== 'bytes') {
    return null
  } else {
    const range = parsed[0]
    return { start: range.start, end: range.end }
  }
}
