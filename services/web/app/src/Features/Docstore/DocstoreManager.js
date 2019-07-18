/* eslint-disable
    camelcase,
    handle-callback-err,
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
let DocstoreManager
const request = require('request').defaults({ jar: false })
const logger = require('logger-sharelatex')
const settings = require('settings-sharelatex')
const Errors = require('../Errors/Errors')

module.exports = DocstoreManager = {
  deleteDoc(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log({ project_id, doc_id }, 'deleting doc in docstore api')
    const url = `${
      settings.apis.docstore.url
    }/project/${project_id}/doc/${doc_id}`
    return request.del(url, function(error, res, body) {
      if (error != null) {
        return callback(error)
      }
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return callback(null)
      } else if (res.statusCode === 404) {
        error = new Errors.NotFoundError('tried to delete doc not in docstore')
        logger.warn(
          { err: error, project_id, doc_id },
          'tried to delete doc not in docstore'
        )
        return callback(error) // maybe suppress the error when delete doc which is not present?
      } else {
        error = new Error(
          `docstore api responded with non-success code: ${res.statusCode}`
        )
        logger.warn(
          { err: error, project_id, doc_id },
          'error deleting doc in docstore'
        )
        return callback(error)
      }
    })
  },

  getAllDocs(project_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log({ project_id }, 'getting all docs for project in docstore api')
    const url = `${settings.apis.docstore.url}/project/${project_id}/doc`
    return request.get(
      {
        url,
        json: true
      },
      function(error, res, docs) {
        if (error != null) {
          return callback(error)
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null, docs)
        } else {
          error = new Error(
            `docstore api responded with non-success code: ${res.statusCode}`
          )
          logger.warn(
            { err: error, project_id },
            'error getting all docs from docstore'
          )
          return callback(error)
        }
      }
    )
  },

  getAllRanges(project_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log(
      { project_id },
      'getting all doc ranges for project in docstore api'
    )
    const url = `${settings.apis.docstore.url}/project/${project_id}/ranges`
    return request.get(
      {
        url,
        json: true
      },
      function(error, res, docs) {
        if (error != null) {
          return callback(error)
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null, docs)
        } else {
          error = new Error(
            `docstore api responded with non-success code: ${res.statusCode}`
          )
          logger.warn(
            { err: error, project_id },
            'error getting all doc ranges from docstore'
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
      callback = function(error, lines, rev, version) {}
    }
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    logger.log({ project_id, doc_id, options }, 'getting doc in docstore api')
    let url = `${
      settings.apis.docstore.url
    }/project/${project_id}/doc/${doc_id}`
    if (options.include_deleted) {
      url += '?include_deleted=true'
    }
    return request.get(
      {
        url,
        json: true
      },
      function(error, res, doc) {
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
          error = new Errors.NotFoundError('doc not found in docstore')
          logger.warn(
            { err: error, project_id, doc_id },
            'doc not found in docstore'
          )
          return callback(error)
        } else {
          error = new Error(
            `docstore api responded with non-success code: ${res.statusCode}`
          )
          logger.warn(
            { err: error, project_id, doc_id },
            'error getting doc from docstore'
          )
          return callback(error)
        }
      }
    )
  },

  updateDoc(project_id, doc_id, lines, version, ranges, callback) {
    if (callback == null) {
      callback = function(error, modified, rev) {}
    }
    logger.log({ project_id, doc_id }, 'updating doc in docstore api')
    const url = `${
      settings.apis.docstore.url
    }/project/${project_id}/doc/${doc_id}`
    return request.post(
      {
        url,
        json: {
          lines,
          version,
          ranges
        }
      },
      function(error, res, result) {
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
          error = new Error(
            `docstore api responded with non-success code: ${res.statusCode}`
          )
          logger.warn(
            { err: error, project_id, doc_id },
            'error updating doc in docstore'
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
    request.post(url, function(err, res, docs) {
      if (err != null) {
        logger.warn(
          { err, project_id },
          `error calling ${method} project in docstore`
        )
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
  }
}
