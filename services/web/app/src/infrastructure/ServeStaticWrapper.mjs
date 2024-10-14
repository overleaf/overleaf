import express from 'express'
import { plainTextResponse } from './Response.js'

/*
    This wrapper is implemented specifically to handle "Premature Close" errors.
    These errors occur when the client cancels a request while static assets are being loaded.
    This issue is beyond our control, it can result in unnecessary log noise.
    Therefore, this wrapper is added to handle such errors.
*/
function serveStaticWrapper(root, options) {
  const serveStatic = express.static(root, options)
  return (req, res, next) => {
    serveStatic(req, res, error => {
      if (!error) {
        return next()
      }

      if (error.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        return next(error)
      }

      req.logger.addFields({ err: error })
      req.logger.setLevel('debug')
      if (res.headersSent) {
        res.end()
      } else {
        res.status(400)
        plainTextResponse(res, 'Premature close')
      }
    })
  }
}

export default serveStaticWrapper
