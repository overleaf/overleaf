/* eslint-disable
    camelcase,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const logger = require('logger-sharelatex')
const FileStoreHandler = require('./FileStoreHandler')
const ProjectLocator = require('../Project/ProjectLocator')
const _ = require('underscore')

const is_mobile_safari = user_agent =>
  user_agent &&
  (user_agent.indexOf('iPhone') >= 0 || user_agent.indexOf('iPad') >= 0)

const is_html = function(file) {
  const ends_with = ext =>
    file.name != null &&
    file.name.length > ext.length &&
    file.name.lastIndexOf(ext) === file.name.length - ext.length

  return ends_with('.html') || ends_with('.htm') || ends_with('.xhtml')
}

module.exports = {
  getFile(req, res) {
    const project_id = req.params.Project_id
    const file_id = req.params.File_id
    const queryString = req.query
    const user_agent = req.get('User-Agent')
    logger.log({ project_id, file_id, queryString }, 'file download')
    return ProjectLocator.findElement(
      { project_id, element_id: file_id, type: 'file' },
      function(err, file) {
        if (err != null) {
          logger.err(
            { err, project_id, file_id, queryString },
            'error finding element for downloading file'
          )
          return res.sendStatus(500)
        }
        return FileStoreHandler.getFileStream(
          project_id,
          file_id,
          queryString,
          function(err, stream) {
            if (err != null) {
              logger.err(
                { err, project_id, file_id, queryString },
                'error getting file stream for downloading file'
              )
              return res.sendStatus(500)
            }
            // mobile safari will try to render html files, prevent this
            if (is_mobile_safari(user_agent) && is_html(file)) {
              logger.log(
                { filename: file.name, user_agent },
                'sending html file to mobile-safari as plain text'
              )
              res.setHeader('Content-Type', 'text/plain')
            }
            res.setContentDisposition('attachment', { filename: file.name })
            return stream.pipe(res)
          }
        )
      }
    )
  }
}
