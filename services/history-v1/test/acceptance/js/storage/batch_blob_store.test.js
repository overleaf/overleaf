'use strict'

const { expect } = require('chai')

const cleanup = require('./support/cleanup')
const testFiles = require('./support/test_files')

const core = require('overleaf-editor-core')
const File = core.File

const storage = require('../../../../storage')
const BatchBlobStore = storage.BatchBlobStore
const BlobStore = storage.BlobStore

const projectId = '123'
const blobStore = new BlobStore(projectId)
const batchBlobStore = new BatchBlobStore(blobStore)

describe('BatchBlobStore', function () {
  beforeEach(cleanup.everything)

  it('can preload and batch getBlob calls', async function () {
    // Add some test files
    await Promise.all([
      blobStore.putFile(testFiles.path('graph.png')),
      blobStore.putFile(testFiles.path('hello.txt')),
    ])

    // Cache some blobs (one that exists and another that doesn't)
    await batchBlobStore.preload([
      testFiles.GRAPH_PNG_HASH,
      File.EMPTY_FILE_HASH, // not found
    ])
    expect(batchBlobStore.blobs.size).to.equal(1)

    const [cached, notCachedExists, notCachedNotExists, duplicate] =
      await Promise.all([
        batchBlobStore.getBlob(testFiles.GRAPH_PNG_HASH), // cached
        batchBlobStore.getBlob(testFiles.HELLO_TXT_HASH), // not cached; exists
        batchBlobStore.getBlob(File.EMPTY_FILE_HASH), // not cached; not exists
        batchBlobStore.getBlob(testFiles.GRAPH_PNG_HASH), // duplicate
      ])

    expect(cached.getHash()).to.equal(testFiles.GRAPH_PNG_HASH)
    expect(notCachedExists.getHash()).to.equal(testFiles.HELLO_TXT_HASH)
    expect(notCachedNotExists).to.be.undefined
    expect(duplicate.getHash()).to.equal(testFiles.GRAPH_PNG_HASH)

    // We should get exactly the object from the cache.
    expect(cached).to.equal(batchBlobStore.blobs.get(testFiles.GRAPH_PNG_HASH))
  })
})
