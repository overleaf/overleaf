/* eslint-disable
    no-cond-assign,
    no-unused-vars,
    n/no-deprecated-api,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ForbidSymlinks
const Path = require('node:path')
const fs = require('node:fs')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')

module.exports = ForbidSymlinks = function (staticFn, root, options) {
  const expressStatic = staticFn(root, options)
  const basePath = Path.resolve(root)
  return function (req, res, next) {
    let file, projectId, result
    const path = req.url
    // check that the path is of the form /project_id_or_name/path/to/file.log
    if ((result = path.match(/^\/([a-zA-Z0-9_-]+)\/(.*)$/s))) {
      projectId = result[1]
      file = result[2]
      if (path !== `/${projectId}/${file}`) {
        logger.warn({ path }, 'unrecognized file request')
        return res.sendStatus(404)
      }
    } else {
      logger.warn({ path }, 'unrecognized file request')
      return res.sendStatus(404)
    }
    // check that the file does not use a relative path
    for (const dir of Array.from(file.split('/'))) {
      if (dir === '..') {
        logger.warn({ path }, 'attempt to use a relative path')
        return res.sendStatus(404)
      }
    }
    // check that the requested path is normalized
    const requestedFsPath = `${basePath}/${projectId}/${file}`
    if (requestedFsPath !== Path.normalize(requestedFsPath)) {
      logger.error(
        { path: requestedFsPath },
        'requestedFsPath is not normalized'
      )
      return res.sendStatus(404)
    }
    // check that the requested path is not a symlink
    return fs.realpath(requestedFsPath, function (err, realFsPath) {
      if (err != null) {
        if (err.code === 'ENOENT') {
          return res.sendStatus(404)
        } else {
          logger.error(
            {
              err,
              requestedFsPath,
              realFsPath,
              path: req.params[0],
              projectId: req.params.project_id,
            },
            'error checking file access'
          )
          return res.sendStatus(500)
        }
      } else if (requestedFsPath !== realFsPath) {
        logger.warn(
          {
            requestedFsPath,
            realFsPath,
            path: req.params[0],
            projectId: req.params.project_id,
          },
          'trying to access a different file (symlink), aborting'
        )
        return res.sendStatus(404)
      } else {
        return expressStatic(req, res, next)
      }
    })
  }
}
