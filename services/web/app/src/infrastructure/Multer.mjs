import fs from 'node:fs'
import Path from 'node:path'
import crypto from 'node:crypto'
import multer from 'multer'
import lodash from 'lodash'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'

const defaultsDeep = lodash.defaultsDeep

export { multer }

/* multer upload handler with automatic cleanup to work around
 * https://github.com/expressjs/multer/issues/259
 */

function filenameWithCleanup(uploadDir) {
  return function (req, file, cb) {
    const name = crypto.randomUUID()
    // add an event handler to clean up files on aborted requests
    req.once('close', () => {
      if (!req.complete) {
        const uploadPath = Path.join(uploadDir, name)
        fs.unlink(uploadPath, err => {
          if (err && err.code !== 'ENOENT') {
            logger.warn(
              { err, uploadPath },
              'error deleting uploaded file on multer cleanup'
            )
          }
        })
      }
    })
    cb(null, name)
  }
}

export function multerUploadHandler(options = {}) {
  const mergedOptions = defaultsDeep({}, options, Settings.multerOptions)
  const { dest, ...multerConfig } = mergedOptions
  // replace dest parameter with custom storage that cleans up leaked files
  if (dest) {
    multerConfig.storage = multer.diskStorage({
      destination: dest,
      filename: filenameWithCleanup(dest),
    })
  }
  return multer(multerConfig)
}

/* remove the uploaded file when an error reaches the end of the route,
 * so route handlers don't each have to unlink on every error path
 */
export function multerErrorHandler(err, req, res, next) {
  if (req.file?.path) {
    fs.unlink(req.file.path, unlinkErr => {
      if (unlinkErr && unlinkErr.code !== 'ENOENT') {
        logger.warn(
          { err: unlinkErr, uploadPath: req.file.path },
          'error deleting uploaded file on multer error cleanup'
        )
      }
    })
  }
  next(err)
}
