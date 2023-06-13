/* eslint-disable
    n/handle-callback-err,
    max-len,
    no-unused-vars,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ProjectRootDocManager
const ProjectEntityHandler = require('./ProjectEntityHandler')
const ProjectEntityUpdateHandler = require('./ProjectEntityUpdateHandler')
const ProjectGetter = require('./ProjectGetter')
const DocumentHelper = require('../Documents/DocumentHelper')
const Path = require('path')
const fs = require('fs')
const { promisify } = require('util')
const async = require('async')
const globby = require('globby')
const _ = require('underscore')
const { promisifyAll } = require('../../util/promises')

module.exports = ProjectRootDocManager = {
  setRootDocAutomatically(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ProjectEntityHandler.getAllDocs(projectId, function (error, docs) {
      if (error != null) {
        return callback(error)
      }

      const jobs = _.map(
        docs,
        (doc, path) =>
          function (cb) {
            if (
              ProjectEntityUpdateHandler.isPathValidForRootDoc(path) &&
              DocumentHelper.contentHasDocumentclass(doc.lines)
            ) {
              async.setImmediate(function () {
                cb(doc._id)
              })
            } else {
              async.setImmediate(function () {
                cb(null)
              })
            }
          }
      )

      return async.series(jobs, function (rootDocId) {
        if (rootDocId != null) {
          return ProjectEntityUpdateHandler.setRootDoc(
            projectId,
            rootDocId,
            callback
          )
        } else {
          return callback()
        }
      })
    })
  },

  findRootDocFileFromDirectory(directoryPath, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const filePathsPromise = globby(['**/*.{tex,Rtex}'], {
      cwd: directoryPath,
      followSymlinkedDirectories: false,
      onlyFiles: true,
      case: false,
    })

    // the search order is such that we prefer files closer to the project root, then
    // we go by file size in ascending order, because people often have a main
    // file that just includes a bunch of other files; then we go by name, in
    // order to be deterministic
    filePathsPromise.then(
      unsortedFiles =>
        ProjectRootDocManager._sortFileList(
          unsortedFiles,
          directoryPath,
          function (err, files) {
            if (err != null) {
              return callback(err)
            }
            let doc = null

            return async.until(
              cb => cb(null, doc != null || files.length === 0),
              function (cb) {
                const file = files.shift()
                return fs.readFile(
                  Path.join(directoryPath, file),
                  'utf8',
                  function (error, content) {
                    if (error != null) {
                      return cb(error)
                    }
                    content = (content || '').replace(/\r/g, '')
                    if (DocumentHelper.contentHasDocumentclass(content)) {
                      doc = { path: file, content }
                    }
                    return cb(null)
                  }
                )
              },
              err =>
                callback(
                  err,
                  doc != null ? doc.path : undefined,
                  doc != null ? doc.content : undefined
                )
            )
          }
        ),
      err => callback(err)
    )

    // coffeescript's implicit-return mechanism returns filePathsPromise from this method, which confuses mocha
    return null
  },

  setRootDocFromName(projectId, rootDocName, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ProjectEntityHandler.getAllDocPathsFromProjectById(
      projectId,
      function (error, docPaths) {
        let docId, path
        if (error != null) {
          return callback(error)
        }
        // strip off leading and trailing quotes from rootDocName
        rootDocName = rootDocName.replace(/^\'|\'$/g, '')
        // prepend a slash for the root folder if not present
        if (rootDocName[0] !== '/') {
          rootDocName = `/${rootDocName}`
        }
        // find the root doc from the filename
        let rootDocId = null
        for (docId in docPaths) {
          // docpaths have a leading / so allow matching "folder/filename" and "/folder/filename"
          path = docPaths[docId]
          if (path === rootDocName) {
            rootDocId = docId
          }
        }
        // try a basename match if there was no match
        if (!rootDocId) {
          for (docId in docPaths) {
            path = docPaths[docId]
            if (Path.basename(path) === Path.basename(rootDocName)) {
              rootDocId = docId
            }
          }
        }
        // set the root doc id if we found a match
        if (rootDocId != null) {
          return ProjectEntityUpdateHandler.setRootDoc(
            projectId,
            rootDocId,
            callback
          )
        } else {
          return callback()
        }
      }
    )
  },

  ensureRootDocumentIsSet(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ProjectGetter.getProject(
      projectId,
      { rootDoc_id: 1 },
      function (error, project) {
        if (error != null) {
          return callback(error)
        }
        if (project == null) {
          return callback(new Error('project not found'))
        }

        if (project.rootDoc_id != null) {
          return callback()
        } else {
          return ProjectRootDocManager.setRootDocAutomatically(
            projectId,
            callback
          )
        }
      }
    )
  },

  /**
   * @param {ObjectId | string} project_id
   * @param {Function} callback
   */
  ensureRootDocumentIsValid(projectId, callback) {
    ProjectGetter.getProjectWithoutDocLines(
      projectId,
      function (error, project) {
        if (error != null) {
          return callback(error)
        }
        if (project == null) {
          return callback(new Error('project not found'))
        }

        if (project.rootDoc_id != null) {
          ProjectEntityHandler.getDocPathFromProjectByDocId(
            project,
            project.rootDoc_id,
            (err, docPath) => {
              if (docPath) return callback()
              ProjectEntityUpdateHandler.unsetRootDoc(projectId, () =>
                ProjectRootDocManager.setRootDocAutomatically(
                  projectId,
                  callback
                )
              )
            }
          )
        } else {
          return ProjectRootDocManager.setRootDocAutomatically(
            projectId,
            callback
          )
        }
      }
    )
  },

  _sortFileList(listToSort, rootDirectory, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return async.mapLimit(
      listToSort,
      5,
      (filePath, cb) =>
        fs.stat(Path.join(rootDirectory, filePath), function (err, stat) {
          if (err != null) {
            return cb(err)
          }
          return cb(null, {
            size: stat.size,
            path: filePath,
            elements: filePath.split(Path.sep).length,
            name: Path.basename(filePath),
          })
        }),
      function (err, files) {
        if (err != null) {
          return callback(err)
        }

        return callback(
          null,
          _.map(
            files.sort(ProjectRootDocManager._rootDocSort),
            file => file.path
          )
        )
      }
    )
  },

  _rootDocSort(a, b) {
    // sort first by folder depth
    if (a.elements !== b.elements) {
      return a.elements - b.elements
    }
    // ensure main.tex is at the start of each folder
    if (a.name === 'main.tex' && b.name !== 'main.tex') {
      return -1
    }
    if (a.name !== 'main.tex' && b.name === 'main.tex') {
      return 1
    }
    // prefer smaller files
    if (a.size !== b.size) {
      return a.size - b.size
    }
    // otherwise, use the full path name
    return a.path.localeCompare(b.path)
  },
}

module.exports = ProjectRootDocManager
module.exports.promises = promisifyAll(module.exports, {
  without: ['_rootDocSort'],
  multiResult: {
    findRootDocFileFromDirectory: ['path', 'content'],
  },
})
