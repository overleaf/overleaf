// @ts-check
'use strict'

const { expect } = require('chai')

const {
  buildSetContentOperations,
} = require('../../lib/build_set_content_operations')
const { blobHashFromString } = require('../../lib/blob_utils')
const Blob = require('../../lib/blob')
const File = require('../../lib/file')
const Snapshot = require('../../lib/snapshot')
const AddFileOperation = require('../../lib/operation/add_file_operation')
const EditFileOperation = require('../../lib/operation/edit_file_operation')
const MoveFileOperation = require('../../lib/operation/move_file_operation')
const SetFileMetadataOperation = require('../../lib/operation/set_file_metadata_operation')

const TS = new Date('2026-07-10T00:00:00.000Z')
const IMPORTED_AT = '2026-01-02T03:04:05.678Z'
const TRACKING = { userId: 'user-1', ts: TS }
const PATHNAME = 'main.tex'

/**
 * In-memory blob store implementing the parts of the BlobStore interface
 * used by buildSetContentOperations and File.load('eager').
 */
class InMemoryBlobStore {
  constructor() {
    /** @type {Map<string, {content: string, blob: Blob}>} */
    this.blobs = new Map()
  }

  /**
   * @param {string} content
   * @return {Promise<Blob>}
   */
  async putString(content) {
    const hash = blobHashFromString(content)
    const blob = new Blob(hash, Buffer.byteLength(content), content.length)
    this.blobs.set(hash, { content, blob })
    return blob
  }

  /**
   * @param {object} obj
   * @return {Promise<Blob>}
   */
  async putObject(obj) {
    return await this.putString(JSON.stringify(obj))
  }

  /**
   * @param {string} hash
   * @return {Promise<Blob | null>}
   */
  async getBlob(hash) {
    return this.blobs.get(hash)?.blob ?? null
  }

  /**
   * @param {string} hash
   * @return {Promise<string>}
   */
  async getString(hash) {
    const entry = this.blobs.get(hash)
    if (entry == null) {
      throw new Error(`no blob: ${hash}`)
    }
    return entry.content
  }

  /**
   * @template [T=unknown]
   * @param {string} hash
   * @return {Promise<T>}
   */
  async getObject(hash) {
    return JSON.parse(await this.getString(hash))
  }

  /**
   * Store binary content, which has no string length.
   *
   * @param {string} content
   * @return {Promise<Blob>}
   */
  async putBinary(content) {
    const hash = blobHashFromString(content)
    const blob = new Blob(hash, Buffer.byteLength(content), undefined)
    this.blobs.set(hash, { content, blob })
    return blob
  }
}

describe('buildSetContentOperations', function () {
  /** @type {InMemoryBlobStore} */
  let blobStore
  beforeEach(function () {
    blobStore = new InMemoryBlobStore()
  })

  it('requires exactly one of content and blob', async function () {
    for (const args of [
      {},
      { content: 'a', blob: new Blob(blobHashFromString('a'), 1, 1) },
    ]) {
      let error
      try {
        await buildSetContentOperations({
          ...args,
          file: null,
          pathname: PATHNAME,
          blobStore,
        })
      } catch (err) {
        error = err
      }
      expect(error)
        .to.be.an('error')
        .with.property('message')
        .that.contains('exactly one of content and blob')
    }
  })

  describe('with string content', function () {
    it('edits an existing editable file with a minimal diff', async function () {
      const file = File.fromString('hello cruel world')
      const { operations, status } = await buildSetContentOperations({
        file,
        pathname: PATHNAME,
        content: 'hello brave world',
        blobStore,
      })
      expect(status).to.equal('applied')
      expect(operations).to.have.length(1)
      const operation = operations[0]
      if (!(operation instanceof EditFileOperation)) {
        expect.fail('expected an EditFileOperation')
        return
      }
      expect(operation.getPathname()).to.equal(PATHNAME)
      const freshFile = File.fromString('hello cruel world')
      operation.applyTo(makeSnapshot(freshFile))
      expect(freshFile.getContent()).to.equal('hello brave world')
    })

    it('eagerly loads a lazy editable file before diffing', async function () {
      const blob = await blobStore.putString('one\ntwo\nthree')
      const file = File.createLazyFromBlobs(blob)
      const { operations } = await buildSetContentOperations({
        file,
        pathname: PATHNAME,
        content: 'one\ntwo and a half\nthree',
        blobStore,
      })
      expect(operations).to.have.length(1)
      expect(operations[0]).to.be.an.instanceof(EditFileOperation)
    })

    it('reports identical content as a noop', async function () {
      const file = File.fromString('hello world')
      const { operations, status } = await buildSetContentOperations({
        file,
        pathname: PATHNAME,
        content: 'hello world',
        blobStore,
      })
      expect(status).to.equal('noop')
      expect(operations).to.eql([])
    })

    it('clears doc metadata when metadata is not provided', async function () {
      const file = File.fromString('hello world', { main: true })
      const { operations, status } = await buildSetContentOperations({
        file,
        pathname: PATHNAME,
        content: 'hello world',
        blobStore,
      })
      expect(status).to.equal('applied')
      expect(operations).to.have.length(1)
      const operation = operations[0]
      if (!(operation instanceof SetFileMetadataOperation)) {
        expect.fail('expected a SetFileMetadataOperation')
        return
      }
      expect(operation.getMetadata()).to.eql({})
    })

    it('updates doc metadata when explicitly provided', async function () {
      const file = File.fromString('hello world')
      const { operations, status } = await buildSetContentOperations({
        file,
        pathname: PATHNAME,
        content: 'hello brave world',
        metadata: { main: true },
        blobStore,
      })
      expect(status).to.equal('applied')
      expect(operations).to.have.length(2)
      expect(operations[0]).to.be.an.instanceof(EditFileOperation)
      const metadataOperation = operations[1]
      if (!(metadataOperation instanceof SetFileMetadataOperation)) {
        expect.fail('expected a SetFileMetadataOperation')
        return
      }
      expect(metadataOperation.getMetadata()).to.eql({ main: true })
    })

    it('updates doc metadata when the content is unchanged', async function () {
      const file = File.fromString('hello world')
      const { operations, status } = await buildSetContentOperations({
        file,
        pathname: PATHNAME,
        content: 'hello world',
        metadata: { main: true },
        blobStore,
      })
      expect(status).to.equal('applied')
      expect(operations).to.have.length(1)
      expect(operations[0]).to.be.an.instanceof(SetFileMetadataOperation)
    })

    it('reports identical content and metadata as a noop', async function () {
      const file = File.fromString('hello world', { main: true })
      const { status } = await buildSetContentOperations({
        file,
        pathname: PATHNAME,
        content: 'hello world',
        metadata: { main: true },
        blobStore,
      })
      expect(status).to.equal('noop')
    })

    it('records a whole-document tracked delete as a change', async function () {
      const file = File.fromString('abc')
      const { operations, status } = await buildSetContentOperations({
        file,
        pathname: PATHNAME,
        content: '',
        tracking: TRACKING,
        blobStore,
      })
      expect(status).to.equal('applied')
      expect(operations).to.have.length(1)
    })

    it('replaces an existing binary file with an editable doc', async function () {
      const existingBlob = await blobStore.putBinary('%PDF-1.5')
      const file = File.createLazyFromBlobs(existingBlob)
      const { operations, status } = await buildSetContentOperations({
        file,
        pathname: PATHNAME,
        content: 'hello world',
        metadata: { main: true },
        blobStore,
      })
      expect(status).to.equal('applied')
      expect(operations).to.have.length(2)
      const [removeOperation, addOperation] = operations
      if (!(removeOperation instanceof MoveFileOperation)) {
        expect.fail('expected a MoveFileOperation')
        return
      }
      expect(removeOperation.isRemoveFile()).to.be.true
      if (!(addOperation instanceof AddFileOperation)) {
        expect.fail('expected an AddFileOperation')
        return
      }
      const newFile = addOperation.getFile()
      expect(newFile.getHash()).to.equal(blobHashFromString('hello world'))
      expect(newFile.getStringLength()).to.equal('hello world'.length)
      expect(newFile.getMetadata()).to.eql({ main: true })
      expect(
        await blobStore.getString(blobHashFromString('hello world'))
      ).to.equal('hello world')
    })

    it('reports a binary file with identical content and metadata as a noop', async function () {
      // A "binary" file whose bytes happen to match the uploaded string
      const existingBlob = await blobStore.putBinary('hello world')
      const file = File.createLazyFromBlobs(existingBlob, undefined, {
        main: true,
      })
      const { status } = await buildSetContentOperations({
        file,
        pathname: PATHNAME,
        content: 'hello world',
        metadata: { main: true },
        blobStore,
      })
      expect(status).to.equal('noop')
    })

    it('creates a new doc when there is no file at the pathname', async function () {
      const { operations, status } = await buildSetContentOperations({
        file: null,
        pathname: PATHNAME,
        content: 'hello world',
        blobStore,
      })
      expect(status).to.equal('applied')
      expect(operations).to.have.length(1)
      expect(operations[0]).to.be.an.instanceof(AddFileOperation)
    })

    it('records new doc content as a tracked insert when requested', async function () {
      const { operations } = await buildSetContentOperations({
        file: null,
        pathname: PATHNAME,
        content: 'hello world',
        tracking: TRACKING,
        blobStore,
      })
      const addOperation = expectAddFileOperation(operations[0])
      const rangesHash = addOperation.getFile().getRangesHash()
      expect(rangesHash).to.be.a('string')
      const ranges = await blobStore.getObject(
        /** @type {string} */ (rangesHash)
      )
      expect(ranges).to.eql({
        comments: [],
        trackedChanges: [
          {
            range: { pos: 0, length: 'hello world'.length },
            tracking: {
              type: 'insert',
              userId: 'user-1',
              ts: TS.toISOString(),
            },
          },
        ],
      })
    })

    it('does not create a ranges blob for empty tracked content', async function () {
      const { operations } = await buildSetContentOperations({
        file: null,
        pathname: PATHNAME,
        content: '',
        tracking: TRACKING,
        blobStore,
      })
      const addOperation = expectAddFileOperation(operations[0])
      expect(addOperation.getFile().getRangesHash()).to.not.exist
    })
  })

  describe('with a blob', function () {
    it('replaces an existing binary file', async function () {
      const existingBlob = await blobStore.putBinary('old bytes')
      const file = File.createLazyFromBlobs(existingBlob)
      const newBlob = await blobStore.putBinary('new bytes')
      const { operations, status } = await buildSetContentOperations({
        file,
        pathname: PATHNAME,
        blob: newBlob,
        blobStore,
      })
      expect(status).to.equal('applied')
      expect(operations).to.have.length(2)
      const addOperation = expectAddFileOperation(operations[1])
      expect(addOperation.getFile().getHash()).to.equal(newBlob.getHash())
    })

    it('converts a doc into a binary file', async function () {
      const docBlob = await blobStore.putString('hello world')
      const file = File.createLazyFromBlobs(docBlob)
      const newBlob = await blobStore.putBinary('%PDF-1.5')
      const { operations } = await buildSetContentOperations({
        file,
        pathname: PATHNAME,
        blob: newBlob,
        blobStore,
      })
      expect(operations).to.have.length(2)
      const [removeOperation, addOperation] = operations
      expect(expectMoveFileOperation(removeOperation).isRemoveFile()).to.be.true
      expect(expectAddFileOperation(addOperation).getFile().getStringLength())
        .to.be.null
    })

    it('reports the same hash and metadata as a noop', async function () {
      const blob = await blobStore.putBinary('same bytes')
      const file = File.createLazyFromBlobs(blob, undefined, { main: true })
      const { operations, status } = await buildSetContentOperations({
        file,
        pathname: PATHNAME,
        blob,
        metadata: { main: true },
        blobStore,
      })
      expect(status).to.equal('noop')
      expect(operations).to.eql([])
    })

    it('only sets metadata when the hash matches but metadata differs', async function () {
      const blob = await blobStore.putBinary('same bytes')
      const file = File.createLazyFromBlobs(blob, undefined, { main: false })
      const { operations, status } = await buildSetContentOperations({
        file,
        pathname: PATHNAME,
        blob,
        metadata: { main: true },
        blobStore,
      })
      expect(status).to.equal('applied')
      expect(operations).to.have.length(1)
      const operation = operations[0]
      if (!(operation instanceof SetFileMetadataOperation)) {
        expect.fail('expected a SetFileMetadataOperation')
        return
      }
      expect(operation.getMetadata()).to.eql({ main: true })
    })

    it('adds a new file when there is no file at the pathname', async function () {
      const blob = await blobStore.putBinary('new bytes')
      const { operations } = await buildSetContentOperations({
        file: null,
        pathname: PATHNAME,
        blob,
        metadata: { importedAt: IMPORTED_AT },
        blobStore,
      })
      expect(operations).to.have.length(1)
      const addOperation = expectAddFileOperation(operations[0])
      expect(addOperation.getFile().getMetadata()).to.eql({
        importedAt: IMPORTED_AT,
      })
    })

    it('ignores the tracking option', async function () {
      const blob = await blobStore.putBinary('new bytes')
      const { operations } = await buildSetContentOperations({
        file: null,
        pathname: PATHNAME,
        blob,
        tracking: TRACKING,
        blobStore,
      })
      const addOperation = expectAddFileOperation(operations[0])
      expect(addOperation.getFile().getRangesHash()).to.not.exist
    })
  })
})

/**
 * @param {unknown} operation
 * @return {AddFileOperation}
 */
function expectAddFileOperation(operation) {
  if (!(operation instanceof AddFileOperation)) {
    throw new Error('expected an AddFileOperation')
  }
  return operation
}

/**
 * @param {unknown} operation
 * @return {MoveFileOperation}
 */
function expectMoveFileOperation(operation) {
  if (!(operation instanceof MoveFileOperation)) {
    throw new Error('expected a MoveFileOperation')
  }
  return operation
}

/**
 * @param {File} file
 * @return {Snapshot}
 */
function makeSnapshot(file) {
  const snapshot = new Snapshot()
  snapshot.addFile(PATHNAME, file)
  return snapshot
}
