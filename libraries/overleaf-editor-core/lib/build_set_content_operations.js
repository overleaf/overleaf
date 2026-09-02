// @ts-check
'use strict'

const _ = require('lodash')
const OError = require('@overleaf/o-error')
const File = require('./file')
const Operation = require('./operation')
const TrackingProps = require('./file_data/tracking_props')
const { diffAsTextOperation } = require('./diff_as_text_operation')

/**
 * @import Blob from './blob'
 * @import StringFileData from './file_data/string_file_data'
 * @import { FileMetadata, ReadWriteBlobStore, RangesBlob } from './types'
 */

/**
 * Build the operations that set the content of a pathname (a setDoc-like
 * upsert).
 *
 * Exactly one of `content` (editable doc) and `blob` (binary file) must be
 * provided. An existing editable doc is edited in place with a minimal diff
 * (see diffAsTextOperation); any other case replaces or creates the file at
 * the pathname. New content is stored in the blob store and referenced by
 * hash, so the returned operations are cheap to serialize.
 *
 * @param {object} args
 * @param {File | null | undefined} args.file existing file at the pathname
 * @param {string} args.pathname
 * @param {string} [args.content] new doc content
 * @param {Blob} [args.blob] blob with the new file content
 * @param {FileMetadata} [args.metadata] metadata for the file; the file's
 *        metadata is always replaced with this value (defaults to empty
 *        metadata)
 * @param {{userId: string, ts: Date}} [args.tracking] record the change as
 *        tracked changes (ignored when replacing with a blob)
 * @param {ReadWriteBlobStore} args.blobStore
 * @return {Promise<{operations: Operation[], status: 'applied' | 'noop'}>}
 */
async function buildSetContentOperations({
  file,
  pathname,
  content,
  blob,
  metadata = {},
  tracking,
  blobStore,
}) {
  if ((content == null) === (blob == null)) {
    throw new OError(
      'buildSetContentOperations: exactly one of content and blob must be given',
      { pathname }
    )
  }

  if (content != null) {
    if (file) {
      // Eager loading resolves both the editability of files whose data is a
      // bare hash and the content to diff against.
      await file.load('eager', blobStore)
      if (file.isEditable()) {
        return buildEditOperations(file, pathname, content, metadata, tracking)
      }
    }
    blob = await blobStore.putString(content)
  }
  if (blob == null) {
    throw new OError('buildSetContentOperations: no blob', { pathname })
  }

  if (file && file.getHash() === blob.getHash()) {
    // LazyStringFileData yields no hash with buffered changes, no false-positive hash matches possible.
    if (_.isEqual(file.getMetadata(), metadata)) {
      return { operations: [], status: 'noop' }
    }
    return {
      operations: [Operation.setFileMetadata(pathname, metadata)],
      status: 'applied',
    }
  }

  let rangesBlob
  if (content != null && content.length > 0 && tracking) {
    // Record the whole new doc as a tracked insert.
    /** @type {RangesBlob} */
    const ranges = {
      comments: [],
      trackedChanges: [
        {
          range: { pos: 0, length: content.length },
          tracking: new TrackingProps(
            'insert',
            tracking.userId,
            tracking.ts
          ).toRaw(),
        },
      ],
    }
    rangesBlob = await blobStore.putObject(ranges)
  }

  const newFile = File.createLazyFromBlobs(blob, rangesBlob, metadata)
  const operations = []
  if (file) {
    operations.push(Operation.removeFile(pathname))
  }
  operations.push(Operation.addFile(pathname, newFile))
  return { operations, status: 'applied' }
}

/**
 * @param {File} file eagerly loaded editable file
 * @param {string} pathname
 * @param {string} content
 * @param {Object} metadata metadata to set on the doc
 * @param {{userId: string, ts: Date}} [tracking]
 * @return {{operations: Operation[], status: 'applied' | 'noop'}}
 */
function buildEditOperations(file, pathname, content, metadata, tracking) {
  const fileData = /** @type {StringFileData} */ (file.data)
  const textOperation = diffAsTextOperation(
    fileData,
    content,
    tracking ? { tracking } : {}
  )
  const operations = []
  if (!textOperation.isNoop()) {
    operations.push(Operation.editFile(pathname, textOperation))
  }
  if (!_.isEqual(file.getMetadata(), metadata)) {
    operations.push(Operation.setFileMetadata(pathname, metadata))
  }
  if (operations.length === 0) {
    return { operations, status: 'noop' }
  }
  return { operations, status: 'applied' }
}

module.exports = { buildSetContentOperations }
