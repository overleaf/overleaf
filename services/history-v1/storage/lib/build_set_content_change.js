// @ts-check

'use strict'

const OError = require('@overleaf/o-error')
const core = require('overleaf-editor-core')
const {
  buildSetContentOperations,
} = require('overleaf-editor-core/lib/build_set_content_operations')
const assert = require('./assert')
const chunkStore = require('./chunk_store')
const { BlobStore } = require('./blob_store')

const { Change, TextOperation } = core

/**
 * @import { Change, Origin } from 'overleaf-editor-core'
 */

class ContentTooLargeError extends OError {}
class BlobNotFoundError extends OError {}

/**
 * Build a change that sets the content of a pathname (a setDoc-like upsert).
 *
 * Computes the change against the current head (persisted chunk plus buffered
 * changes) without committing it. The caller is responsible for committing
 * the change with `baseVersion` as the expected end version, rebasing or
 * transforming it first if the head has moved on in the meantime.
 *
 * New content is stored in the blob store as a side effect, so the returned
 * change is cheap to serialize and can be committed as-is later.
 *
 * @param {string} projectId
 * @param {string} pathname
 * @param {object} opts
 * @param {string} [opts.content] new doc content (exactly one of content and
 *        blobHash must be given)
 * @param {string} [opts.blobHash] hash of an already created blob with the
 *        new binary file content
 * @param {Object} [opts.metadata] metadata for the file; the file's metadata
 *        is always replaced with this value (defaults to empty metadata)
 * @param {string} [opts.userId]
 * @param {Date} opts.timestamp
 * @param {Origin} opts.origin
 * @param {boolean} [opts.trackChanges] record the change as tracked changes
 *        (ignored when blobHash is given)
 * @return {Promise<{change: Change | null, baseVersion: number}>} the change
 *         to commit (null when the content and metadata already match) and
 *         the version of the head it was built against
 */
async function buildSetContentChange(projectId, pathname, opts) {
  const {
    content,
    blobHash,
    metadata,
    userId,
    timestamp,
    origin,
    trackChanges = false,
  } = opts

  assert.projectId(projectId, 'bad projectId')
  if (content != null && content.length > TextOperation.MAX_STRING_LENGTH) {
    throw new ContentTooLargeError('content is too large', {
      projectId,
      pathname,
      contentLength: content.length,
    })
  }
  if ((content == null) === (blobHash == null)) {
    throw new OError(
      'buildSetContentChange: exactly one of content and blobHash must be given',
      { projectId, pathname }
    )
  }
  if (trackChanges && !userId) {
    throw new OError('buildSetContentChange: trackChanges requires a userId', {
      projectId,
      pathname,
    })
  }

  const blobStore = new BlobStore(projectId)
  let blob
  if (blobHash != null) {
    blob = await blobStore.getBlob(blobHash)
    if (blob == null) {
      throw new BlobNotFoundError('blob not found', { projectId, blobHash })
    }
  }

  const tracking = trackChanges
    ? { userId: /** @type {string} */ (userId), ts: timestamp }
    : undefined

  const chunk = await chunkStore.loadLatest(projectId)
  const snapshot = chunk.getSnapshot()
  snapshot.applyAll(chunk.getChanges())
  const baseVersion = chunk.getEndVersion()

  const { operations, status } = await buildSetContentOperations({
    file: snapshot.getFile(pathname),
    pathname,
    content,
    blob,
    metadata,
    tracking,
    blobStore,
  })
  if (status === 'noop') {
    return { change: null, baseVersion }
  }

  const change = new Change(
    operations,
    timestamp,
    [],
    origin,
    userId ? [userId] : []
  )
  return { change, baseVersion }
}

module.exports = {
  buildSetContentChange,
  ContentTooLargeError,
  BlobNotFoundError,
}
