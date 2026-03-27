import multer from 'multer'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'

const upload = multer({
  dest: Settings.path.uploadFolder,
  limits: {
    fileSize: Settings.maxUploadSize,
    parts: 2,
  },
})

function multerMiddleware(req, res, next) {
  return upload.single('qqfile')(req, res, function (err) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(422).json({ success: false, error: 'file_too_large' })
    }
    if (err) return next(err)
    if (!req.file?.path) {
      logger.info({ req }, 'missing req.file.path on upload')
      return res
        .status(400)
        .json({ success: false, error: 'invalid_upload_request' })
    }
    next()
  })
}

export default {
  multerMiddleware,
}
