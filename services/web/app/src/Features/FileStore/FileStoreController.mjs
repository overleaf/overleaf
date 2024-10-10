import logger from '@overleaf/logger'
import FileStoreHandler from './FileStoreHandler.js'
import ProjectLocator from '../Project/ProjectLocator.js'
import Errors from '../Errors/Errors.js'
import { preparePlainTextResponse } from '../../infrastructure/Response.js'

export default {
  getFile(req, res) {
    const projectId = req.params.Project_id
    const fileId = req.params.File_id
    const queryString = req.query
    const userAgent = req.get('User-Agent')
    ProjectLocator.findElement(
      { project_id: projectId, element_id: fileId, type: 'file' },
      function (err, file) {
        if (err) {
          if (err instanceof Errors.NotFoundError) {
            logger.warn(
              { err, projectId, fileId, queryString },
              'entity not found when downloading file'
            )
            // res.sendStatus() sends a description of the status as body.
            // Using res.status().end() avoids sending that fake body.
            return res.status(404).end()
          } else {
            logger.err(
              { err, projectId, fileId, queryString },
              'error finding element for downloading file'
            )
            return res.status(500).end()
          }
        }
        FileStoreHandler.getFileStream(
          projectId,
          fileId,
          queryString,
          function (err, stream) {
            if (err) {
              logger.err(
                { err, projectId, fileId, queryString },
                'error getting file stream for downloading file'
              )
              return res.sendStatus(500)
            }
            // mobile safari will try to render html files, prevent this
            if (isMobileSafari(userAgent) && isHtml(file)) {
              preparePlainTextResponse(res)
            }
            res.setContentDisposition('attachment', { filename: file.name })
            // allow the browser to cache these immutable files
            // note: both "private" and "max-age" appear to be required for caching
            res.setHeader('Cache-Control', 'private, max-age=3600')
            stream.pipe(res)
          }
        )
      }
    )
  },

  getFileHead(req, res) {
    const projectId = req.params.Project_id
    const fileId = req.params.File_id
    FileStoreHandler.getFileSize(projectId, fileId, (err, fileSize) => {
      if (err) {
        if (err instanceof Errors.NotFoundError) {
          res.status(404).end()
        } else {
          logger.err({ err, projectId, fileId }, 'error getting file size')
          res.status(500).end()
        }
        return
      }
      res.setHeader('Content-Length', fileSize)
      res.status(200).end()
    })
  },
}

function isHtml(file) {
  return (
    fileEndsWith(file, '.html') ||
    fileEndsWith(file, '.htm') ||
    fileEndsWith(file, '.xhtml')
  )
}

function fileEndsWith(file, ext) {
  return (
    file.name != null &&
    file.name.length > ext.length &&
    file.name.lastIndexOf(ext) === file.name.length - ext.length
  )
}

function isMobileSafari(userAgent) {
  return (
    userAgent &&
    (userAgent.indexOf('iPhone') >= 0 || userAgent.indexOf('iPad') >= 0)
  )
}
