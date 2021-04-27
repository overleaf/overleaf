/* eslint-disable
    camelcase,
    node/handle-callback-err,
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
const request = require('request').defaults({ jar: false })
const OError = require('@overleaf/o-error')
const logger = require('logger-sharelatex')
const settings = require('settings-sharelatex')
const Errors = require('../Errors/Errors')
const { promisifyAll } = require('../../util/promises')

const TIMEOUT = 30 * 1000 // request timeout

const DocstoreManager = {
  deleteDoc(project_id, doc_id, name, deletedAt, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const url = `${settings.apis.docstore.url}/project/${project_id}/doc/${doc_id}`
    const docMetaData = { deleted: true, deletedAt, name }
    const options = { url, json: docMetaData, timeout: TIMEOUT }
    request.patch(options, function (error, res) {
      if (error != null) {
        return callback(error)
      }
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return callback(null)
      } else if (res.statusCode === 404) {
        error = new Errors.NotFoundError({
          message: 'tried to delete doc not in docstore',
          info: {
            project_id,
            doc_id,
          },
        })
        return callback(error) // maybe suppress the error when delete doc which is not present?
      } else {
        error = new OError(
          `docstore api responded with non-success code: ${res.statusCode}`,
          {
            project_id,
            doc_id,
          }
        )
        return callback(error)
      }
    })
  },

  getAllDocs(project_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const url = `${settings.apis.docstore.url}/project/${project_id}/doc`
    return request.get(
      {
        url,
        timeout: TIMEOUT,
        json: true,
      },
      function (error, res, docs) {
        if (error != null) {
          return callback(error)
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null, docs)
        } else {
          error = new OError(
            `docstore api responded with non-success code: ${res.statusCode}`,
            { project_id }
          )
          return callback(error)
        }
      }
    )
  },

  getAllDeletedDocs(project_id, callback) {
    const url = `${settings.apis.docstore.url}/project/${project_id}/doc-deleted`
    request.get(
      { url, timeout: TIMEOUT, json: true },
      function (error, res, docs) {
        if (error) {
          callback(
            OError.tag(error, 'could not get deleted docs from docstore')
          )
        } else if (res.statusCode === 200) {
          callback(null, docs)
        } else {
          callback(
            new OError(
              `docstore api responded with non-success code: ${res.statusCode}`,
              { project_id }
            )
          )
        }
      }
    )
  },

  getAllRanges(project_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const url = `${settings.apis.docstore.url}/project/${project_id}/ranges`
    return request.get(
      {
        url,
        timeout: TIMEOUT,
        json: true,
      },
      function (error, res, docs) {
        if (error != null) {
          return callback(error)
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null, docs)
        } else {
          error = new OError(
            `docstore api responded with non-success code: ${res.statusCode}`,
            { project_id }
          )
          return callback(error)
        }
      }
    )
  },

  getDoc(project_id, doc_id, options, callback) {
    if (options == null) {
      options = {}
    }
    if (callback == null) {
      callback = function (error, lines, rev, version) {}
    }
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    let url = `${settings.apis.docstore.url}/project/${project_id}/doc/${doc_id}`
    if (options.include_deleted) {
      url += '?include_deleted=true'
    }
    return request.get(
      {
        url,
        timeout: TIMEOUT,
        json: true,
      },
      function (error, res, doc) {
        if (error != null) {
          return callback(error)
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          logger.log(
            { doc_id, project_id, version: doc.version, rev: doc.rev },
            'got doc from docstore api'
          )
          return callback(null, doc.lines, doc.rev, doc.version, doc.ranges)
        } else if (res.statusCode === 404) {
          error = new Errors.NotFoundError({
            message: 'doc not found in docstore',
            info: {
              project_id,
              doc_id,
            },
          })
          return callback(error)
        } else {
          error = new OError(
            `docstore api responded with non-success code: ${res.statusCode}`,
            {
              project_id,
              doc_id,
            }
          )
          return callback(error)
        }
      }
    )
  },

  isDocDeleted(project_id, doc_id, callback) {
    const url = `${settings.apis.docstore.url}/project/${project_id}/doc/${doc_id}/deleted`
    request.get(
      { url, timeout: TIMEOUT, json: true },
      function (err, res, body) {
        if (err) {
          callback(err)
        } else if (res.statusCode === 200) {
          callback(null, body.deleted)
        } else if (res.statusCode === 404) {
          callback(
            new Errors.NotFoundError({
              message: 'doc does not exist in project',
              info: { project_id, doc_id },
            })
          )
        } else {
          callback(
            new OError(
              `docstore api responded with non-success code: ${res.statusCode}`,
              { project_id, doc_id }
            )
          )
        }
      }
    )
  },

  updateDoc(project_id, doc_id, lines, version, ranges, callback) {
    if (callback == null) {
      callback = function (error, modified, rev) {}
    }
    const url = `${settings.apis.docstore.url}/project/${project_id}/doc/${doc_id}`
    return request.post(
      {
        url,
        timeout: TIMEOUT,
        json: {
          lines,
          version,
          ranges,
        },
      },
      function (error, res, result) {
        if (error != null) {
          return callback(error)
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          logger.log(
            { project_id, doc_id },
            'update doc in docstore url finished'
          )
          return callback(null, result.modified, result.rev)
        } else {
          error = new OError(
            `docstore api responded with non-success code: ${res.statusCode}`,
            { project_id, doc_id }
          )
          return callback(error)
        }
      }
    )
  },

  archiveProject(project_id, callback) {
    DocstoreManager._operateOnProject(project_id, 'archive', callback)
  },

  unarchiveProject(project_id, callback) {
    DocstoreManager._operateOnProject(project_id, 'unarchive', callback)
  },

  destroyProject(project_id, callback) {
    DocstoreManager._operateOnProject(project_id, 'destroy', callback)
  },

  _operateOnProject(project_id, method, callback) {
    const url = `${settings.apis.docstore.url}/project/${project_id}/${method}`
    logger.log({ project_id }, `calling ${method} for project in docstore`)
    // use default timeout for archiving/unarchiving/destroying
    request.post(url, function (err, res, docs) {
      if (err != null) {
        OError.tag(err, `error calling ${method} project in docstore`, {
          project_id,
        })
        return callback(err)
      }

      if (res.statusCode >= 200 && res.statusCode < 300) {
        callback()
      } else {
        const error = new Error(
          `docstore api responded with non-success code: ${res.statusCode}`
        )
        logger.warn(
          { err: error, project_id },
          `error calling ${method} project in docstore`
        )
        callback(error)
      }
    })
  },
}

module.exports = DocstoreManager
module.exports.promises = promisifyAll(DocstoreManager, {
  multiResult: {
    getDoc: ['lines', 'rev', 'version', 'ranges'],
    updateDoc: ['modified', 'rev'],
  },
})
