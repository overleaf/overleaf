const AuthorizationManager = require('../Authorization/AuthorizationManager')
const CompileManager = require('../Compile/CompileManager')
const ClsiManager = require('../Compile/ClsiManager')
const ProjectFileAgent = require('./ProjectFileAgent')
const _ = require('underscore')
const {
  CompileFailedError,
  BadDataError,
  AccessDeniedError,
  OutputFileFetchFailedError,
} = require('./LinkedFilesErrors')
const LinkedFilesHandler = require('./LinkedFilesHandler')

function _prepare(projectId, linkedFileData, userId, callback) {
  _checkAuth(projectId, linkedFileData, userId, (err, allowed) => {
    if (err) {
      return callback(err)
    }
    if (!allowed) {
      return callback(new AccessDeniedError())
    }
    if (!_validate(linkedFileData)) {
      return callback(new BadDataError())
    }
    callback(null, linkedFileData)
  })
}

function createLinkedFile(
  projectId,
  linkedFileData,
  name,
  parentFolderId,
  userId,
  callback
) {
  if (!ProjectFileAgent._canCreate(linkedFileData)) {
    return callback(new AccessDeniedError())
  }
  linkedFileData = _sanitizeData(linkedFileData)
  _prepare(projectId, linkedFileData, userId, (err, linkedFileData) => {
    if (err) {
      return callback(err)
    }
    _getFileStream(linkedFileData, userId, (err, readStream) => {
      if (err) {
        return callback(err)
      }
      readStream.on('error', callback)
      readStream.on('response', response => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          LinkedFilesHandler.importFromStream(
            projectId,
            readStream,
            linkedFileData,
            name,
            parentFolderId,
            userId,
            (err, file) => {
              if (err) {
                return callback(err)
              }
              callback(null, file._id)
            }
          ) // Created
        } else {
          err = new OutputFileFetchFailedError(
            `Output file fetch failed: ${linkedFileData.build_id}, ${linkedFileData.source_output_file_path}`
          )
          err.statusCode = response.statusCode
          callback(err)
        }
      })
    })
  })
}

function refreshLinkedFile(
  projectId,
  linkedFileData,
  name,
  parentFolderId,
  userId,
  callback
) {
  _prepare(projectId, linkedFileData, userId, (err, linkedFileData) => {
    if (err) {
      return callback(err)
    }
    _compileAndGetFileStream(
      linkedFileData,
      userId,
      (err, readStream, newBuildId) => {
        if (err) {
          return callback(err)
        }
        readStream.on('error', callback)
        readStream.on('response', response => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            linkedFileData.build_id = newBuildId
            LinkedFilesHandler.importFromStream(
              projectId,
              readStream,
              linkedFileData,
              name,
              parentFolderId,
              userId,
              (err, file) => {
                if (err) {
                  return callback(err)
                }
                callback(null, file._id)
              }
            ) // Created
          } else {
            err = new OutputFileFetchFailedError(
              `Output file fetch failed: ${linkedFileData.build_id}, ${linkedFileData.source_output_file_path}`
            )
            err.statusCode = response.statusCode
            callback(err)
          }
        })
      }
    )
  })
}

function _sanitizeData(data) {
  return {
    provider: data.provider,
    source_project_id: data.source_project_id,
    source_output_file_path: data.source_output_file_path,
    build_id: data.build_id,
    clsiServerId: data.clsiServerId,
  }
}

function _validate(data) {
  return (
    (data.v1_source_doc_id != null && data.source_output_file_path != null) ||
    (data.source_project_id != null &&
      data.source_output_file_path != null &&
      data.build_id != null)
  )
}

function _checkAuth(projectId, data, currentUserId, callback) {
  callback = _.once(callback)
  if (!_validate(data)) {
    return callback(new BadDataError())
  }
  LinkedFilesHandler.getSourceProject(data, (err, project) => {
    if (err) {
      return callback(err)
    }
    AuthorizationManager.canUserReadProject(
      currentUserId,
      project._id,
      null,
      (err, canRead) => {
        if (err) {
          return callback(err)
        }
        callback(null, canRead)
      }
    )
  })
}

function _getFileStream(linkedFileData, userId, callback) {
  callback = _.once(callback)
  const {
    source_output_file_path: sourceOutputFilePath,
    build_id: buildId,
    clsiServerId,
  } = linkedFileData
  LinkedFilesHandler.getSourceProject(linkedFileData, (err, project) => {
    if (err) {
      return callback(err)
    }
    const sourceProjectId = project._id
    CompileManager.getProjectCompileLimits(sourceProjectId, (err, limits) => {
      if (err) return callback(err)

      ClsiManager.getOutputFileStream(
        sourceProjectId,
        userId,
        limits,
        clsiServerId,
        buildId,
        sourceOutputFilePath,
        (err, readStream) => {
          if (err) {
            return callback(err)
          }
          readStream.pause()
          callback(null, readStream)
        }
      )
    })
  })
}

function _compileAndGetFileStream(linkedFileData, userId, callback) {
  callback = _.once(callback)
  const { source_output_file_path: sourceOutputFilePath } = linkedFileData
  LinkedFilesHandler.getSourceProject(linkedFileData, (err, project) => {
    if (err) {
      return callback(err)
    }
    const sourceProjectId = project._id
    CompileManager.compile(
      sourceProjectId,
      userId,
      {},
      (err, status, outputFiles, clsiServerId, limits) => {
        if (err) {
          return callback(err)
        }
        if (status !== 'success') {
          return callback(new CompileFailedError())
        }
        const outputFile = _.find(
          outputFiles,
          o => o.path === sourceOutputFilePath
        )
        if (outputFile == null) {
          return callback(new OutputFileFetchFailedError())
        }
        const buildId = outputFile.build
        ClsiManager.getOutputFileStream(
          sourceProjectId,
          userId,
          limits,
          clsiServerId,
          buildId,
          sourceOutputFilePath,
          (err, readStream) => {
            if (err) {
              return callback(err)
            }
            readStream.pause()
            callback(null, readStream, buildId)
          }
        )
      }
    )
  })
}

module.exports = { createLinkedFile, refreshLinkedFile }
