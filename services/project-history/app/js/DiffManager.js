import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import async from 'async'
import * as DiffGenerator from './DiffGenerator.js'
import * as FileTreeDiffGenerator from './FileTreeDiffGenerator.js'
import * as UpdatesProcessor from './UpdatesProcessor.js'
import * as HistoryStoreManager from './HistoryStoreManager.js'
import * as WebApiManager from './WebApiManager.js'
import * as ChunkTranslator from './ChunkTranslator.js'
import * as Errors from './Errors.js'

let MAX_CHUNK_REQUESTS = 10

/**
 * Container for functions that need to be mocked in tests
 *
 * TODO: Rewrite tests in terms of exported functions only
 */
export const _mocks = {}

export function getDiff(projectId, pathname, fromVersion, toVersion, callback) {
  UpdatesProcessor.processUpdatesForProject(projectId, error => {
    if (error) {
      return callback(OError.tag(error))
    }
    _getProjectUpdatesBetweenVersions(
      projectId,
      pathname,
      fromVersion,
      toVersion,
      (error, result) => {
        if (error) {
          return callback(OError.tag(error))
        }
        const { binary, initialContent, updates } = result
        let diff
        if (binary) {
          diff = { binary: true }
        } else {
          try {
            diff = DiffGenerator.buildDiff(initialContent, updates)
          } catch (err) {
            return callback(
              OError.tag(err, 'failed to build diff', {
                projectId,
                pathname,
                fromVersion,
                toVersion,
              })
            )
          }
        }
        callback(null, diff)
      }
    )
  })
}

export function getFileTreeDiff(projectId, fromVersion, toVersion, callback) {
  UpdatesProcessor.processUpdatesForProject(projectId, error => {
    if (error) {
      return callback(OError.tag(error))
    }
    _getChunksAsSingleChunk(
      projectId,
      fromVersion,
      toVersion,
      (error, chunk) => {
        let diff
        if (error) {
          return callback(OError.tag(error))
        }
        try {
          diff = FileTreeDiffGenerator.buildDiff(chunk, fromVersion, toVersion)
        } catch (error1) {
          error = error1
          if (error instanceof Errors.InconsistentChunkError) {
            return callback(error)
          } else {
            throw OError.tag(error)
          }
        }
        callback(null, diff)
      }
    )
  })
}

export function _getChunksAsSingleChunk(
  projectId,
  fromVersion,
  toVersion,
  callback
) {
  logger.debug(
    { projectId, fromVersion, toVersion },
    '[_getChunksAsSingleChunk] getting chunks'
  )
  _getChunks(projectId, fromVersion, toVersion, (error, chunks) => {
    if (error) {
      return callback(OError.tag(error))
    }
    logger.debug(
      { projectId, fromVersion, toVersion, chunks },
      '[_getChunksAsSingleChunk] got chunks'
    )
    const chunk = _concatChunks(chunks)
    callback(null, chunk)
  })
}

_mocks._getProjectUpdatesBetweenVersions = (
  projectId,
  pathname,
  fromVersion,
  toVersion,
  callback
) => {
  _getChunksAsSingleChunk(projectId, fromVersion, toVersion, (error, chunk) => {
    if (error) {
      return callback(OError.tag(error))
    }
    logger.debug(
      { projectId, pathname, fromVersion, toVersion, chunk },
      '[_getProjectUpdatesBetweenVersions] concatted chunk'
    )
    ChunkTranslator.convertToDiffUpdates(
      projectId,
      chunk,
      pathname,
      fromVersion,
      toVersion,
      callback
    )
  })
}

export function _getProjectUpdatesBetweenVersions(...args) {
  _mocks._getProjectUpdatesBetweenVersions(...args)
}

_mocks._getChunks = (projectId, fromVersion, toVersion, callback) => {
  let chunksRequested = 0
  let lastChunkStartVersion = toVersion
  const chunks = []

  function shouldRequestAnotherChunk(cb) {
    const stillUnderChunkLimit = chunksRequested < MAX_CHUNK_REQUESTS
    const stillNeedVersions = fromVersion < lastChunkStartVersion
    const stillSaneStartVersion = lastChunkStartVersion > 0
    logger.debug(
      {
        projectId,
        stillUnderChunkLimit,
        stillNeedVersions,
        stillSaneStartVersion,
        fromVersion,
        lastChunkStartVersion,
        chunksRequested,
      },
      '[_getChunks.shouldRequestAnotherChunk]'
    )
    return cb(
      null,
      stillUnderChunkLimit && stillNeedVersions && stillSaneStartVersion
    )
  }

  function getNextChunk(cb) {
    logger.debug(
      {
        projectId,
        lastChunkStartVersion,
      },
      '[_getChunks.getNextChunk]'
    )
    WebApiManager.getHistoryId(projectId, (error, historyId) => {
      if (error) {
        return cb(OError.tag(error))
      }
      HistoryStoreManager.getChunkAtVersion(
        projectId,
        historyId,
        lastChunkStartVersion,
        (error, chunk) => {
          if (error) {
            return cb(OError.tag(error))
          }
          lastChunkStartVersion = chunk.chunk.startVersion
          chunksRequested += 1
          chunks.push(chunk)
          cb()
        }
      )
    })
  }

  getNextChunk(error => {
    if (error) {
      return callback(OError.tag(error))
    }
    async.whilst(shouldRequestAnotherChunk, getNextChunk, error => {
      if (error) {
        return callback(error)
      }
      if (chunksRequested >= MAX_CHUNK_REQUESTS) {
        error = new Errors.BadRequestError('Diff spans too many chunks')
        callback(error)
      } else {
        callback(null, chunks)
      }
    })
  })
}

export function _getChunks(...args) {
  _mocks._getChunks(...args)
}

_mocks._concatChunks = chunks => {
  chunks.reverse()
  const chunk = chunks[0]
  // We will append all of the changes from the later
  // chunks onto the first one, to form one 'big' chunk.
  for (const nextChunk of chunks.slice(1)) {
    chunk.chunk.history.changes = chunk.chunk.history.changes.concat(
      nextChunk.chunk.history.changes
    )
  }
  return chunk
}

function _concatChunks(...args) {
  return _mocks._concatChunks(...args)
}

// for tests
export function setMaxChunkRequests(value) {
  MAX_CHUNK_REQUESTS = value
}
