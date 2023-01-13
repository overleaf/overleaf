import Core from 'overleaf-editor-core'
import { Readable as StringStream } from 'stream'
import BPromise from 'bluebird'
import OError from '@overleaf/o-error'
import * as HistoryStoreManager from './HistoryStoreManager.js'
import * as WebApiManager from './WebApiManager.js'
import * as Errors from './Errors.js'

StringStream.prototype._read = function () {}

const MAX_REQUESTS = 4 // maximum number of parallel requests to v1 history service

export function getFileSnapshotStream(projectId, version, pathname, callback) {
  _getSnapshotAtVersion(projectId, version, (error, snapshot) => {
    if (error) {
      return callback(OError.tag(error))
    }
    const file = snapshot.getFile(pathname)
    if (file == null) {
      error = new Errors.NotFoundError(`${pathname} not found`, {
        projectId,
        version,
        pathname,
      })
      return callback(error)
    }

    WebApiManager.getHistoryId(projectId, (err, historyId) => {
      if (err) {
        return callback(OError.tag(err))
      }
      if (file.isEditable()) {
        file
          .load('eager', HistoryStoreManager.getBlobStore(historyId))
          .then(() => {
            const stream = new StringStream()
            stream.push(file.getContent())
            stream.push(null)
            callback(null, stream)
          })
          .catch(err => callback(err))
      } else {
        HistoryStoreManager.getProjectBlobStream(
          historyId,
          file.getHash(),
          callback
        )
      }
    })
  })
}

// Returns project snapshot containing the document content for files with
// text operations in the relevant chunk, and hashes for unmodified/binary
// files. Used by git bridge to get the state of the project.
export function getProjectSnapshot(projectId, version, callback) {
  _getSnapshotAtVersion(projectId, version, (error, snapshot) => {
    if (error) {
      return callback(OError.tag(error))
    }
    WebApiManager.getHistoryId(projectId, (err, historyId) => {
      if (err) {
        return callback(OError.tag(err))
      }
      _loadFilesLimit(
        snapshot,
        'eager',
        HistoryStoreManager.getBlobStore(historyId)
      )
        .then(() => {
          const data = {
            projectId,
            files: snapshot.getFileMap().files,
          }
          callback(null, data)
        })
        .catch(callback)
    })
  })
}

function _getSnapshotAtVersion(projectId, version, callback) {
  WebApiManager.getHistoryId(projectId, (error, historyId) => {
    if (error) {
      return callback(OError.tag(error))
    }
    HistoryStoreManager.getChunkAtVersion(
      projectId,
      historyId,
      version,
      (error, data) => {
        if (error) {
          return callback(OError.tag(error))
        }
        const chunk = Core.Chunk.fromRaw(data.chunk)
        const snapshot = chunk.getSnapshot()
        const changes = chunk
          .getChanges()
          .slice(0, version - chunk.getStartVersion())
        snapshot.applyAll(changes)
        callback(null, snapshot)
      }
    )
  })
}

export function getLatestSnapshot(projectId, historyId, callback) {
  HistoryStoreManager.getMostRecentChunk(projectId, historyId, (err, data) => {
    if (err) {
      return callback(err)
    }
    if (data == null || data.chunk == null) {
      return callback(new OError('undefined chunk'))
    }
    // apply all the changes in the chunk to get the current snapshot
    const chunk = Core.Chunk.fromRaw(data.chunk)
    const snapshot = chunk.getSnapshot()
    const changes = chunk.getChanges()
    snapshot.applyAll(changes)
    snapshot
      .loadFiles('lazy', HistoryStoreManager.getBlobStore(historyId))
      .then(snapshotFiles => callback(null, snapshotFiles))
      .catch(err => callback(err))
  })
}

function _loadFilesLimit(snapshot, kind, blobStore) {
  // bluebird promises only support a limit on concurrency for map()
  // so make an array of the files we need to load
  const fileList = []
  snapshot.fileMap.map(file => fileList.push(file))
  // load the files in parallel with a limit on the concurrent requests
  return BPromise.map(
    fileList,
    file => {
      // only load changed files, others can be dereferenced from their
      // blobs (this method is only used by the git bridge which
      // understands how to load blobs).
      if (!file.isEditable() || file.getHash()) {
        return
      }
      return file.load(kind, blobStore)
    },
    { concurrency: MAX_REQUESTS }
  )
}
