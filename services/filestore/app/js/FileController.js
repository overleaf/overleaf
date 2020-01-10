const PersistorManager = require('./PersistorManager')
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
  req.setLogMessage('getting file')
  req.addLogFields({
    key,
    bucket,
    format,
    style,
    cacheWarm: req.query.cacheWarm
  })

  if (req.headers.range) {
    const range = _getRange(req.headers.range)
    if (range) {
      options.start = range.start
      options.end = range.end
      req.addLogField('range', range)
    }
  }

  FileHandler.getFile(bucket, key, options, function(err, fileStream) {
    if (err) {
      if (err instanceof Errors.NotFoundError) {
        res.sendStatus(404)
      } else {
        next(err)
      }
      return
    }

    if (req.query.cacheWarm) {
      return res.sendStatus(200).end()
    }

    pipeline(fileStream, res, err => {
      if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        next(
          new Errors.ReadError({
            message: 'error transferring stream',
            info: { bucket, key, format, style }
          }).withCause(err)
        )
      }
    })
  })
}

function getFileHead(req, res, next) {
  const { key, bucket } = req

  metrics.inc('getFileSize')
  req.setLogMessage('getting file size')
  req.addLogFields({ key, bucket })

  FileHandler.getFileSize(bucket, key, function(err, fileSize) {
    if (err) {
      if (err instanceof Errors.NotFoundError) {
        res.sendStatus(404)
      } else {
        next(err)
      }
      return
    }
    res.set('Content-Length', fileSize)
    res.status(200).end()
  })
}

function insertFile(req, res, next) {
  metrics.inc('insertFile')
  const { key, bucket } = req

  req.setLogMessage('inserting file')
  req.addLogFields({ key, bucket })

  FileHandler.insertFile(bucket, key, req, function(err) {
    if (err) {
      next(err)
    } else {
      res.sendStatus(200)
    }
  })
}

function copyFile(req, res, next) {
  metrics.inc('copyFile')
  const { key, bucket } = req
  const oldProjectId = req.body.source.project_id
  const oldFileId = req.body.source.file_id

  req.addLogFields({
    key,
    bucket,
    oldProject_id: oldProjectId,
    oldFile_id: oldFileId
  })
  req.setLogMessage('copying file')

  PersistorManager.copyFile(
    bucket,
    `${oldProjectId}/${oldFileId}`,
    key,
    function(err) {
      if (err) {
        if (err instanceof Errors.NotFoundError) {
          res.sendStatus(404)
        } else {
          next(err)
        }
        return
      }

      res.sendStatus(200)
    }
  )
}

function deleteFile(req, res, next) {
  metrics.inc('deleteFile')
  const { key, bucket } = req

  req.addLogFields({ key, bucket })
  req.setLogMessage('deleting file')

  FileHandler.deleteFile(bucket, key, function(err) {
    if (err) {
      next(err)
    } else {
      res.sendStatus(204)
    }
  })
}

function directorySize(req, res, next) {
  metrics.inc('projectSize')
  const { project_id: projectId, bucket } = req

  req.setLogMessage('getting project size')
  req.addLogFields({ projectId, bucket })

  FileHandler.getDirectorySize(bucket, projectId, function(err, size) {
    if (err) {
      return next(err)
    }

    res.json({ 'total bytes': size })
    req.addLogField('size', size)
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
