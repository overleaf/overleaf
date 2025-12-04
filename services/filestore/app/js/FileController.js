import FileHandler from './FileHandler.js'
import metrics from '@overleaf/metrics'
import parseRange from 'range-parser'
import Errors from './Errors.js'
import { pipeline } from 'node:stream'

const maxSizeInBytes = 1024 * 1024 * 1024 // 1GB

export default {
  getFile,
  getFileHead,
  insertFile,
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
  if (req.useSubdirectories) options.useSubdirectories = true

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

function _getRange(header) {
  const parsed = parseRange(maxSizeInBytes, header)
  if (parsed === -1 || parsed === -2 || parsed.type !== 'bytes') {
    return null
  } else {
    const range = parsed[0]
    return { start: range.start, end: range.end }
  }
}
