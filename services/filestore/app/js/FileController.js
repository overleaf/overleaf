const FileHandler = require('./FileHandler')
const metrics = require('@overleaf/metrics')
const parseRange = require('range-parser')
const Errors = require('./Errors')
const { pipeline } = require('node:stream')

const maxSizeInBytes = 1024 * 1024 * 1024 // 1GB

module.exports = {
  getFile,
  getFileHead,
  insertFile,
  copyFile,
  deleteFile,
  deleteProject,
  directorySize,
}

function getFile(req, res, next) {
  const { key, bucket } = req
  const { format, style } = req.query
  const options = {
    key,
    bucket,
    format,
    style,
  }

  metrics.inc('getFile')
  req.requestLogger.setMessage('getting file')
  req.requestLogger.addFields({
    key,
    bucket,
    format,
    style,
    cacheWarm: req.query.cacheWarm,
  })

  if (req.headers.range) {
    const range = _getRange(req.headers.range)
    if (range) {
      options.start = range.start
      options.end = range.end
      req.requestLogger.addFields({ range })
    }
  }

  FileHandler.getRedirectUrl(bucket, key, options, function (err, redirectUrl) {
    if (err) {
      metrics.inc('file_redirect_error')
    }

    if (redirectUrl) {
      metrics.inc('file_redirect')
      return res.redirect(redirectUrl)
    }

    FileHandler.getFile(bucket, key, options, function (err, fileStream) {
      if (err) {
        if (err instanceof Errors.NotFoundError) {
          res.sendStatus(404)
        } else {
          next(err)
        }
        return
      }

      if (req.query.cacheWarm) {
        fileStream.destroy()
        return res.sendStatus(200).end()
      }

      pipeline(fileStream, res, err => {
        if (err && err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
          res.end()
        } else if (err) {
          next(
            new Errors.ReadError(
              'error transferring stream',
              { bucket, key, format, style },
              err
            )
          )
        }
      })
    })
  })
}

function getFileHead(req, res, next) {
  const { key, bucket } = req

  metrics.inc('getFileSize')
  req.requestLogger.setMessage('getting file size')
  req.requestLogger.addFields({ key, bucket })

  FileHandler.getFileSize(bucket, key, function (err, fileSize) {
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

  req.requestLogger.setMessage('inserting file')
  req.requestLogger.addFields({ key, bucket })

  FileHandler.insertFile(bucket, key, req, function (err) {
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

  req.requestLogger.addFields({
    key,
    bucket,
    oldProject_id: oldProjectId,
    oldFile_id: oldFileId,
  })
  req.requestLogger.setMessage('copying file')

  FileHandler.copyObject(bucket, `${oldProjectId}/${oldFileId}`, key, err => {
    if (err) {
      if (err instanceof Errors.NotFoundError) {
        res.sendStatus(404)
      } else {
        next(err)
      }
    } else {
      res.sendStatus(200)
    }
  })
}

function deleteFile(req, res, next) {
  metrics.inc('deleteFile')
  const { key, bucket } = req

  req.requestLogger.addFields({ key, bucket })
  req.requestLogger.setMessage('deleting file')

  FileHandler.deleteFile(bucket, key, function (err) {
    if (err) {
      next(err)
    } else {
      res.sendStatus(204)
    }
  })
}

function deleteProject(req, res, next) {
  metrics.inc('deleteProject')
  const { key, bucket } = req

  req.requestLogger.setMessage('deleting project')
  req.requestLogger.addFields({ key, bucket })

  FileHandler.deleteProject(bucket, key, function (err) {
    if (err) {
      if (err instanceof Errors.InvalidParametersError) {
        return res.sendStatus(400)
      }
      next(err)
    } else {
      res.sendStatus(204)
    }
  })
}

function directorySize(req, res, next) {
  metrics.inc('projectSize')
  const { project_id: projectId, bucket } = req

  req.requestLogger.setMessage('getting project size')
  req.requestLogger.addFields({ projectId, bucket })

  FileHandler.getDirectorySize(bucket, projectId, function (err, size) {
    if (err) {
      return next(err)
    }

    res.json({ 'total bytes': size })
    req.requestLogger.addFields({ size })
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
