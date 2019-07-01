/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-undef,
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
let ProjectZipStreamManager
const archiver = require('archiver')
const async = require('async')
const logger = require('logger-sharelatex')
const ProjectEntityHandler = require('../Project/ProjectEntityHandler')
const ProjectGetter = require('../Project/ProjectGetter')
const FileStoreHandler = require('../FileStore/FileStoreHandler')

module.exports = ProjectZipStreamManager = {
  createZipStreamForMultipleProjects(project_ids, callback) {
    // We'll build up a zip file that contains multiple zip files

    if (callback == null) {
      callback = function(error, stream) {}
    }
    const archive = archiver('zip')
    archive.on('error', err =>
      logger.err(
        { err, project_ids },
        'something went wrong building archive of project'
      )
    )
    callback(null, archive)

    logger.log({ project_ids }, 'creating zip stream of multiple projects')

    const jobs = []
    for (let project_id of Array.from(project_ids || [])) {
      ;(project_id =>
        jobs.push(callback =>
          ProjectGetter.getProject(project_id, { name: true }, function(
            error,
            project
          ) {
            if (error != null) {
              return callback(error)
            }
            logger.log(
              { project_id, name: project.name },
              'appending project to zip stream'
            )
            return ProjectZipStreamManager.createZipStreamForProject(
              project_id,
              function(error, stream) {
                if (error != null) {
                  return callback(error)
                }
                archive.append(stream, { name: `${project.name}.zip` })
                return stream.on('end', function() {
                  logger.log(
                    { project_id, name: project.name },
                    'zip stream ended'
                  )
                  return callback()
                })
              }
            )
          })
        ))(project_id)
    }

    return async.series(jobs, function() {
      logger.log(
        { project_ids },
        'finished creating zip stream of multiple projects'
      )
      return archive.finalize()
    })
  },

  createZipStreamForProject(project_id, callback) {
    if (callback == null) {
      callback = function(error, stream) {}
    }
    const archive = archiver('zip')
    // return stream immediately before we start adding things to it
    archive.on('error', err =>
      logger.err(
        { err, project_id },
        'something went wrong building archive of project'
      )
    )
    callback(null, archive)
    return this.addAllDocsToArchive(project_id, archive, error => {
      if (error != null) {
        logger.error(
          { err: error, project_id },
          'error adding docs to zip stream'
        )
      }
      return this.addAllFilesToArchive(project_id, archive, error => {
        if (error != null) {
          logger.error(
            { err: error, project_id },
            'error adding files to zip stream'
          )
        }
        return archive.finalize()
      })
    })
  },

  addAllDocsToArchive(project_id, archive, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return ProjectEntityHandler.getAllDocs(project_id, function(error, docs) {
      if (error != null) {
        return callback(error)
      }
      const jobs = []
      for (let path in docs) {
        const doc = docs[path]
        ;(function(path, doc) {
          if (path[0] === '/') {
            path = path.slice(1)
          }
          return jobs.push(function(callback) {
            logger.log({ project_id }, 'Adding doc')
            archive.append(doc.lines.join('\n'), { name: path })
            return callback()
          })
        })(path, doc)
      }
      return async.series(jobs, callback)
    })
  },

  addAllFilesToArchive(project_id, archive, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return ProjectEntityHandler.getAllFiles(project_id, function(error, files) {
      if (error != null) {
        return callback(error)
      }
      const jobs = []
      for (let path in files) {
        const file = files[path]
        ;((path, file) =>
          jobs.push(callback =>
            FileStoreHandler.getFileStream(project_id, file._id, {}, function(
              error,
              stream
            ) {
              if (error != null) {
                logger.warn(
                  { err: error, project_id, file_id: file._id },
                  'something went wrong adding file to zip archive'
                )
                return callback(err)
              }
              if (path[0] === '/') {
                path = path.slice(1)
              }
              archive.append(stream, { name: path })
              return stream.on('end', () => callback())
            })
          ))(path, file)
      }
      return async.parallelLimit(jobs, 5, callback)
    })
  }
}
