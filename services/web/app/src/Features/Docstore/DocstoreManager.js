const { promisify } = require('util')
const { promisifyMultiResult } = require('@overleaf/promise-utils')
const request = require('request').defaults({ jar: false })
const OError = require('@overleaf/o-error')
const logger = require('@overleaf/logger')
const settings = require('@overleaf/settings')
const Errors = require('../Errors/Errors')

const TIMEOUT = 30 * 1000 // request timeout

function deleteDoc(projectId, docId, name, deletedAt, callback) {
  const url = `${settings.apis.docstore.url}/project/${projectId}/doc/${docId}`
  const docMetaData = { deleted: true, deletedAt, name }
  const options = { url, json: docMetaData, timeout: TIMEOUT }
  request.patch(options, (error, res) => {
    if (error) {
      return callback(error)
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      callback(null)
    } else if (res.statusCode === 404) {
      error = new Errors.NotFoundError({
        message: 'tried to delete doc not in docstore',
        info: {
          projectId,
          docId,
        },
      })
      callback(error) // maybe suppress the error when delete doc which is not present?
    } else {
      error = new OError(
        `docstore api responded with non-success code: ${res.statusCode}`,
        {
          projectId,
          docId,
        }
      )
      callback(error)
    }
  })
}

/**
 * @param {string} projectId
 */
function getAllDocs(projectId, callback) {
  const url = `${settings.apis.docstore.url}/project/${projectId}/doc`
  request.get(
    {
      url,
      timeout: TIMEOUT,
      json: true,
    },
    (error, res, docs) => {
      if (error) {
        return callback(error)
      }
      if (res.statusCode >= 200 && res.statusCode < 300) {
        callback(null, docs)
      } else {
        error = new OError(
          `docstore api responded with non-success code: ${res.statusCode}`,
          { projectId }
        )
        callback(error)
      }
    }
  )
}

function getAllDeletedDocs(projectId, callback) {
  const url = `${settings.apis.docstore.url}/project/${projectId}/doc-deleted`
  request.get({ url, timeout: TIMEOUT, json: true }, (error, res, docs) => {
    if (error) {
      callback(OError.tag(error, 'could not get deleted docs from docstore'))
    } else if (res.statusCode === 200) {
      callback(null, docs)
    } else {
      callback(
        new OError(
          `docstore api responded with non-success code: ${res.statusCode}`,
          { projectId }
        )
      )
    }
  })
}

/**
 * @param {string} projectId
 * @param {Callback} callback
 */
function getAllRanges(projectId, callback) {
  const url = `${settings.apis.docstore.url}/project/${projectId}/ranges`
  request.get(
    {
      url,
      timeout: TIMEOUT,
      json: true,
    },
    (error, res, docs) => {
      if (error) {
        return callback(error)
      }
      if (res.statusCode >= 200 && res.statusCode < 300) {
        callback(null, docs)
      } else {
        error = new OError(
          `docstore api responded with non-success code: ${res.statusCode}`,
          { projectId }
        )
        callback(error)
      }
    }
  )
}

function getDoc(projectId, docId, options, callback) {
  if (options == null) {
    options = {}
  }
  if (typeof options === 'function') {
    callback = options
    options = {}
  }
  const requestParams = { timeout: TIMEOUT, json: true }
  if (options.peek) {
    requestParams.url = `${settings.apis.docstore.url}/project/${projectId}/doc/${docId}/peek`
  } else {
    requestParams.url = `${settings.apis.docstore.url}/project/${projectId}/doc/${docId}`
  }
  if (options.include_deleted) {
    requestParams.qs = { include_deleted: 'true' }
  }
  request.get(requestParams, (error, res, doc) => {
    if (error) {
      return callback(error)
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      logger.debug(
        { docId, projectId, version: doc.version, rev: doc.rev },
        'got doc from docstore api'
      )
      callback(null, doc.lines, doc.rev, doc.version, doc.ranges)
    } else if (res.statusCode === 404) {
      error = new Errors.NotFoundError({
        message: 'doc not found in docstore',
        info: {
          projectId,
          docId,
        },
      })
      callback(error)
    } else {
      error = new OError(
        `docstore api responded with non-success code: ${res.statusCode}`,
        {
          projectId,
          docId,
        }
      )
      callback(error)
    }
  })
}

function isDocDeleted(projectId, docId, callback) {
  const url = `${settings.apis.docstore.url}/project/${projectId}/doc/${docId}/deleted`
  request.get({ url, timeout: TIMEOUT, json: true }, (err, res, body) => {
    if (err) {
      callback(err)
    } else if (res.statusCode === 200) {
      callback(null, body.deleted)
    } else if (res.statusCode === 404) {
      callback(
        new Errors.NotFoundError({
          message: 'doc does not exist in project',
          info: { projectId, docId },
        })
      )
    } else {
      callback(
        new OError(
          `docstore api responded with non-success code: ${res.statusCode}`,
          { projectId, docId }
        )
      )
    }
  })
}

function updateDoc(projectId, docId, lines, version, ranges, callback) {
  const url = `${settings.apis.docstore.url}/project/${projectId}/doc/${docId}`
  request.post(
    {
      url,
      timeout: TIMEOUT,
      json: {
        lines,
        version,
        ranges,
      },
    },
    (error, res, result) => {
      if (error) {
        return callback(error)
      }
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logger.debug(
          { projectId, docId },
          'update doc in docstore url finished'
        )
        callback(null, result.modified, result.rev)
      } else {
        error = new OError(
          `docstore api responded with non-success code: ${res.statusCode}`,
          { projectId, docId }
        )
        callback(error)
      }
    }
  )
}

/**
 * Asks docstore whether any doc in the project has ranges
 *
 * @param {string} proejctId
 * @param {Callback} callback
 */
function projectHasRanges(projectId, callback) {
  const url = `${settings.apis.docstore.url}/project/${projectId}/has-ranges`
  request.get({ url, timeout: TIMEOUT, json: true }, (err, res, body) => {
    if (err) {
      return callback(err)
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      callback(null, body.projectHasRanges)
    } else {
      callback(
        new OError(
          `docstore api responded with non-success code: ${res.statusCode}`,
          { projectId }
        )
      )
    }
  })
}

function archiveProject(projectId, callback) {
  _operateOnProject(projectId, 'archive', callback)
}

function unarchiveProject(projectId, callback) {
  _operateOnProject(projectId, 'unarchive', callback)
}

function destroyProject(projectId, callback) {
  _operateOnProject(projectId, 'destroy', callback)
}

function _operateOnProject(projectId, method, callback) {
  const url = `${settings.apis.docstore.url}/project/${projectId}/${method}`
  logger.debug({ projectId }, `calling ${method} for project in docstore`)
  // use default timeout for archiving/unarchiving/destroying
  request.post(url, (err, res, docs) => {
    if (err) {
      OError.tag(err, `error calling ${method} project in docstore`, {
        projectId,
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
        { err: error, projectId },
        `error calling ${method} project in docstore`
      )
      callback(error)
    }
  })
}

module.exports = {
  deleteDoc,
  getAllDocs,
  getAllDeletedDocs,
  getAllRanges,
  getDoc,
  isDocDeleted,
  updateDoc,
  projectHasRanges,
  archiveProject,
  unarchiveProject,
  destroyProject,
  promises: {
    deleteDoc: promisify(deleteDoc),
    getAllDocs: promisify(getAllDocs),
    getAllDeletedDocs: promisify(getAllDeletedDocs),
    getAllRanges: promisify(getAllRanges),
    getDoc: promisifyMultiResult(getDoc, ['lines', 'rev', 'version', 'ranges']),
    isDocDeleted: promisify(isDocDeleted),
    updateDoc: promisifyMultiResult(updateDoc, ['modified', 'rev']),
    projectHasRanges: promisify(projectHasRanges),
    archiveProject: promisify(archiveProject),
    unarchiveProject: promisify(unarchiveProject),
    destroyProject: promisify(destroyProject),
  },
}
