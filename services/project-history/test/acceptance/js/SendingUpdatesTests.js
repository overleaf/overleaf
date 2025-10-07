import { expect } from 'chai'
import Settings from '@overleaf/settings'
import assert from 'node:assert'
import crypto from 'node:crypto'
import mongodb from 'mongodb-legacy'
import nock from 'nock'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockFileStore = () => nock('http://127.0.0.1:3009')
const MockWeb = () => nock('http://127.0.0.1:3000')

// Some helper methods to make the tests more compact
function slTextUpdate(historyId, doc, userId, v, ts, op) {
  return {
    projectHistoryId: historyId,
    doc: doc.id,
    op,
    v,

    meta: {
      user_id: userId,
      ts: ts.getTime(),
      pathname: doc.pathname,
      doc_length: doc.length,
    },
  }
}

function slAddDocUpdate(historyId, doc, userId, ts, docLines, ranges = {}) {
  return {
    projectHistoryId: historyId,
    pathname: doc.pathname,
    ranges,
    docLines,
    doc: doc.id,
    meta: { user_id: userId, ts: ts.getTime() },
  }
}

function slAddDocUpdateWithVersion(
  historyId,
  doc,
  userId,
  ts,
  docLines,
  projectVersion,
  ranges = {}
) {
  const result = slAddDocUpdate(historyId, doc, userId, ts, docLines, ranges)
  result.version = projectVersion
  return result
}

function slAddFileUpdate(historyId, file, userId, ts, projectId) {
  return {
    projectHistoryId: historyId,
    pathname: file.pathname,
    url: `http://127.0.0.1:3009/project/${projectId}/file/${file.id}`,
    file: file.id,
    ranges: undefined,
    meta: { user_id: userId, ts: ts.getTime() },
  }
}

function createdBlobFileUpdate(historyId, file, userId, ts, projectId) {
  return {
    projectHistoryId: historyId,
    pathname: file.pathname,
    createdBlob: true,
    url: null,
    file: file.id,
    hash: file.hash,
    ranges: undefined,
    meta: { user_id: userId, ts: ts.getTime() },
  }
}

function slRenameUpdate(historyId, doc, userId, ts, pathname, newPathname) {
  return {
    projectHistoryId: historyId,
    pathname,
    new_pathname: newPathname,
    doc: doc.id,
    meta: { user_id: userId, ts: ts.getTime() },
  }
}

function olUpdate(doc, userId, ts, operations, v) {
  return {
    v2Authors: [userId],
    timestamp: ts.toJSON(),
    authors: [],
    operations,
    v2DocVersions: {
      [doc.id]: {
        pathname: doc.pathname.replace(/^\//, ''), // Strip leading /
        v: v || 1,
      },
    },
  }
}

function olTextOperation(doc, textOperation) {
  return {
    pathname: doc.pathname.replace(/^\//, ''), // Strip leading /
    textOperation,
  }
}

function olAddCommentOperation(doc, commentId, pos, length) {
  return {
    pathname: doc.pathname.replace(/^\//, ''), // Strip leading /
    commentId,
    ranges: [{ pos, length }],
  }
}

function olTextUpdate(doc, userId, ts, textOperation, v) {
  return olUpdate(doc, userId, ts, [olTextOperation(doc, textOperation)], v)
}

function olTextUpdates(doc, userId, ts, textOperations, v) {
  return olUpdate(
    doc,
    userId,
    ts,
    textOperations.map(textOperation => olTextOperation(doc, textOperation)),
    v
  )
}

function olRenameUpdate(doc, userId, ts, pathname, newPathname) {
  return {
    v2Authors: [userId],
    timestamp: ts.toJSON(),
    authors: [],

    operations: [
      {
        pathname,
        newPathname,
      },
    ],
  }
}

function olAddDocUpdate(doc, userId, ts, fileHash, rangesHash = undefined) {
  const update = {
    v2Authors: [userId],
    timestamp: ts.toJSON(),
    authors: [],

    operations: [
      {
        pathname: doc.pathname.replace(/^\//, ''), // Strip leading /
        file: {
          hash: fileHash,
        },
      },
    ],
  }
  if (rangesHash) {
    update.operations[0].file.rangesHash = rangesHash
  }
  return update
}

function olAddDocUpdateWithVersion(
  doc,
  userId,
  ts,
  fileHash,
  version,
  rangesHash = undefined
) {
  const result = olAddDocUpdate(doc, userId, ts, fileHash, rangesHash)
  result.projectVersion = version
  return result
}

function olAddFileUpdate(file, userId, ts, fileHash) {
  return {
    v2Authors: [userId],
    timestamp: ts.toJSON(),
    authors: [],

    operations: [
      {
        pathname: file.pathname.replace(/^\//, ''), // Strip leading /
        file: {
          hash: fileHash,
        },
      },
    ],
  }
}

describe('Sending Updates', function () {
  const historyId = new ObjectId().toString()

  beforeEach(async function () {
    this.timestamp = new Date()

    await ProjectHistoryApp.ensureRunning()

    this.userId = new ObjectId().toString()
    this.projectId = new ObjectId().toString()
    this.docId = new ObjectId().toString()

    this.doc = {
      id: this.docId,
      pathname: '/main.tex',
      length: 5,
    }

    MockHistoryStore().post('/api/projects').reply(200, {
      projectId: historyId,
    })
    MockWeb()
      .get(`/project/${this.projectId}/details`)
      .reply(200, {
        name: 'Test Project',
        overleaf: {
          history: {
            id: historyId,
          },
        },
      })
    await ProjectHistoryClient.initializeProject(historyId)
  })

  afterEach(function () {
    nock.cleanAll()
  })

  describe('basic update types', function () {
    beforeEach(function () {
      MockHistoryStore()
        .get(`/api/projects/${historyId}/latest/history`)
        .reply(200, {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {},
              changes: [],
            },
          },
        })
    })

    it('should send add doc updates to the history store', async function () {
      const fileHash = '0a207c060e61f3b88eaee0a8cd0696f46fb155eb'

      const createBlob = MockHistoryStore()
        .put(`/api/projects/${historyId}/blobs/${fileHash}`, 'a\nb')
        .reply(201)

      const addFile = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olAddDocUpdate(this.doc, this.userId, this.timestamp, fileHash),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slAddDocUpdate(historyId, this.doc, this.userId, this.timestamp, 'a\nb')
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createBlob.isDone(),
        '/api/projects/:historyId/blobs/:hash should have been called'
      )
      assert(
        addFile.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })

    it('should send ranges to the history store', async function () {
      const fileHash = '49e886093b3eacbc12b99a1eb5aeaa44a6b9d90e'
      const rangesHash = 'fa9a429ff518bc9e5b2507a96ff0646b566eca65'

      const historyRanges = {
        trackedChanges: [
          {
            range: { pos: 4, length: 3 },
            tracking: {
              type: 'delete',
              userId: 'user-id-1',
              ts: '2024-01-01T00:00:00.000Z',
            },
          },
        ],
        comments: [
          {
            ranges: [{ pos: 0, length: 3 }],
            id: 'comment-id-1',
          },
        ],
      }

      // We need to set up the ranges mock first, as we will call it last..
      const createRangesBlob = MockHistoryStore()
        .put(`/api/projects/${historyId}/blobs/${rangesHash}`, historyRanges)
        .reply(201)

      const createBlob = MockHistoryStore()
        .put(`/api/projects/${historyId}/blobs/${fileHash}`, 'foo barbaz')
        .reply(201)

      const addFile = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olAddDocUpdate(
              this.doc,
              this.userId,
              this.timestamp,
              fileHash,
              rangesHash
            ),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slAddDocUpdate(
          historyId,
          this.doc,
          this.userId,
          this.timestamp,
          'foo barbaz',
          {
            changes: [
              {
                op: { p: 4, d: 'bar' },
                metadata: {
                  ts: 1704067200000,
                  user_id: 'user-id-1',
                },
              },
            ],
            comments: [
              {
                op: {
                  p: 0,
                  c: 'foo',
                  t: 'comment-id-1',
                },
                metadata: { resolved: false },
              },
            ],
          }
        )
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createBlob.isDone(),
        '/api/projects/:historyId/blobs/:hash should have been called to create content blob'
      )
      assert(
        createRangesBlob.isDone(),
        '/api/projects/:historyId/blobs/:hash should have been called to create ranges blob'
      )
      assert(
        addFile.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })

    it('should strip non-BMP characters in add doc updates before sending to the history store', async function () {
      const fileHash = '11509fe05a41f9cdc51ea081342b5a4fc7c8d0fc'

      const createBlob = MockHistoryStore()
        .put(
          `/api/projects/${historyId}/blobs/${fileHash}`,
          'a\nb\uFFFD\uFFFDc'
        )
        .reply(201)

      const addFile = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olAddDocUpdate(this.doc, this.userId, this.timestamp, fileHash),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slAddDocUpdate(
          historyId,
          this.doc,
          this.userId,
          this.timestamp,
          'a\nb\uD800\uDC00c'
        )
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createBlob.isDone(),
        '/api/projects/:historyId/blobs/:hash should have been called'
      )
      assert(
        addFile.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })

    it('should send text updates to the history store', async function () {
      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olTextUpdate(this.doc, this.userId, this.timestamp, [3, '\nc', 2]),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 1, this.timestamp, [
          { p: 3, i: '\nc' },
        ])
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createChange.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })

    it('should send renames to the history store', async function () {
      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olRenameUpdate(
              this.doc,
              this.userId,
              this.timestamp,
              'main.tex',
              'main2.tex'
            ),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slRenameUpdate(
          historyId,
          this.doc,
          this.userId,
          this.timestamp,
          '/main.tex',
          '/main2.tex'
        )
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createChange.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })

    it('should not get file from filestore if no url provided', async function () {
      const file = {
        id: new ObjectId().toString(),
        pathname: '/test.png',
        contents: Buffer.from([1, 2, 3]),
        hash: 'aed2973e4b8a7ff1b30ff5c4751e5a2b38989e74',
      }

      const fileStoreRequest = MockFileStore()
        .get(`/project/${this.projectId}/file/${file.id}`)
        .reply(200, file.contents)

      const checkBlob = MockHistoryStore()
        .head(`/api/projects/${historyId}/blobs/${file.hash}`)
        .reply(200)

      const addFile = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olAddFileUpdate(file, this.userId, this.timestamp, file.hash),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        createdBlobFileUpdate(
          historyId,
          file,
          this.userId,
          this.timestamp,
          this.projectId
        )
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        !fileStoreRequest.isDone(),
        'filestore should not have been called'
      )

      assert(
        checkBlob.isDone(),
        `HEAD /api/projects/${historyId}/blobs/${file.hash} should have been called`
      )
      assert(
        addFile.isDone(),
        `/api/projects/${historyId}/latest/files should have been called`
      )
    })

    it('should send add file updates to the history store', async function () {
      const file = {
        id: new ObjectId().toString(),
        pathname: '/test.png',
        contents: Buffer.from([1, 2, 3]),
        hash: 'aed2973e4b8a7ff1b30ff5c4751e5a2b38989e74',
      }

      const fileStoreRequest = MockFileStore()
        .get(`/project/${this.projectId}/file/${file.id}`)
        .reply(200, file.contents)

      const createBlob = MockHistoryStore()
        .put(`/api/projects/${historyId}/blobs/${file.hash}`, file.contents)
        .reply(201)

      const addFile = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olAddFileUpdate(file, this.userId, this.timestamp, file.hash),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slAddFileUpdate(
          historyId,
          file,
          this.userId,
          this.timestamp,
          this.projectId
        )
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        fileStoreRequest.isDone(),
        `/project/${this.projectId}/file/${file.id} should have been called`
      )
      assert(
        createBlob.isDone(),
        `/api/projects/${historyId}/latest/files should have been called`
      )
      assert(
        addFile.isDone(),
        `/api/projects/${historyId}/latest/files should have been called`
      )
    })

    it('should send a stub to the history store when the file is large', async function () {
      const fileContents = Buffer.alloc(Settings.maxFileSizeInBytes + 1, 'X')
      const fileSize = Buffer.byteLength(fileContents)

      const fileHash = crypto
        .createHash('sha1')
        .update('blob ' + fileSize + '\x00')
        .update(fileContents, 'utf8')
        .digest('hex')

      const file = {
        id: new ObjectId().toString(),
        pathname: '/large.png',
        contents: fileContents,
        hash: fileHash,
      }

      const stubContents = [
        'FileTooLargeError v1',
        'File too large to be stored in history service',
        `id project-${this.projectId}-file-${file.id}`,
        `size ${fileSize} bytes`,
        `hash ${fileHash}`,
        '\0', // null byte to make this a binary file
      ].join('\n')

      const stubHash = crypto
        .createHash('sha1')
        .update('blob ' + Buffer.byteLength(stubContents) + '\x00')
        .update(stubContents, 'utf8')
        .digest('hex')

      const stub = {
        id: file.id,
        pathname: file.pathname,
        contents: stubContents,
        hash: stubHash,
      }

      const fileStoreRequest = MockFileStore()
        .get(`/project/${this.projectId}/file/${file.id}`)
        .reply(200, file.contents)

      const createBlob = MockHistoryStore()
        .put(`/api/projects/${historyId}/blobs/${stub.hash}`, stub.contents)
        .reply(201)

      const addFile = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olAddFileUpdate(stub, this.userId, this.timestamp, stub.hash),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slAddFileUpdate(
          historyId,
          file,
          this.userId,
          this.timestamp,
          this.projectId
        )
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        addFile.isDone(),
        `/api/projects/${historyId}/latest/files should have been called`
      )
      assert(
        createBlob.isDone(),
        `/api/projects/${historyId}/latest/files should have been called`
      )
      assert(
        fileStoreRequest.isDone(),
        `/project/${this.projectId}/file/${file.id} should have been called`
      )
    })

    it('should handle comment ops', async function () {
      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olUpdate(this.doc, this.userId, this.timestamp, [
              olTextOperation(this.doc, [3, '\nc', 2]),
              olAddCommentOperation(this.doc, 'comment-id-1', 3, 2),
            ]),
            olUpdate(
              this.doc,
              this.userId,
              this.timestamp,
              [olAddCommentOperation(this.doc, 'comment-id-2', 2, 1)],
              2
            ),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 1, this.timestamp, [
          { p: 3, i: '\nc' },
          { p: 3, c: '\nc', t: 'comment-id-1' },
        ])
      )

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 2, this.timestamp, [
          { p: 2, c: 'b', t: 'comment-id-2' },
        ])
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createChange.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })

    it('should be able to process lots of updates in batches', async function () {
      const BATCH_SIZE = 500
      const createFirstChangeBatch = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olTextUpdate(
              this.doc,
              this.userId,
              this.timestamp,
              ['a'.repeat(BATCH_SIZE), 6],
              BATCH_SIZE - 1
            ),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)
      const createSecondChangeBatch = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olTextUpdate(
              this.doc,
              this.userId,
              this.timestamp,
              ['a'.repeat(50), BATCH_SIZE + 6],
              BATCH_SIZE - 1 + 50
            ),
          ])
          return true
        })
        .query({ end_version: 500 })
        .reply(204)
      // these need mocking again for the second batch
      MockHistoryStore()
        .get(`/api/projects/${historyId}/latest/history`)
        .reply(200, {
          chunk: {
            startVersion: BATCH_SIZE,
            history: {
              snapshot: {},
              changes: [],
            },
          },
        })
      MockWeb()
        .get(`/project/${this.projectId}/details`)
        .reply(200, {
          name: 'Test Project',
          overleaf: {
            history: {
              id: historyId,
            },
          },
        })

      // Push updates in a loop instead of using async.times
      for (let n = 0; n < BATCH_SIZE + 50; n++) {
        this.doc.length += 1
        await ProjectHistoryClient.pushRawUpdate(
          this.projectId,
          slTextUpdate(historyId, this.doc, this.userId, n, this.timestamp, [
            { p: 0, i: 'a' },
          ])
        )
      }

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createFirstChangeBatch.isDone(),
        `/api/projects/${historyId}/changes should have been called for the first batch`
      )
      assert(
        createSecondChangeBatch.isDone(),
        `/api/projects/${historyId}/changes should have been called for the second batch`
      )
    })
  })

  describe('compressing updates', function () {
    beforeEach(function () {
      MockHistoryStore()
        .get(`/api/projects/${historyId}/latest/history`)
        .reply(200, {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {},
              changes: [],
            },
          },
        })
    })

    it('should concat adjacent text updates', async function () {
      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olTextUpdate(
              this.doc,
              this.userId,
              this.timestamp,
              [3, 'foobaz', 2],
              2
            ),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 1, this.timestamp, [
          { p: 3, i: 'foobar' },
          { p: 6, d: 'bar' },
        ])
      )
      this.doc.length += 3

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 2, this.timestamp, [
          { p: 6, i: 'baz' },
        ])
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createChange.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })

    it('should take the timestamp of the first update', async function () {
      const timestamp1 = new Date(this.timestamp)
      const timestamp2 = new Date(this.timestamp.getTime() + 10000)
      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olTextUpdate(
              this.doc,
              this.userId,
              timestamp1,
              [3, 'foobaz', 2],
              2
            ),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 1, timestamp1, [
          { p: 3, i: 'foo' },
        ])
      )
      this.doc.length += 3

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 2, timestamp2, [
          { p: 6, i: 'baz' },
        ])
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createChange.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })

    it('should not concat updates more than 60 seconds apart', async function () {
      const timestamp1 = new Date(this.timestamp)
      const timestamp2 = new Date(this.timestamp.getTime() + 120000)
      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olTextUpdate(this.doc, this.userId, timestamp1, [3, 'foo', 2], 1),
            olTextUpdate(this.doc, this.userId, timestamp2, [6, 'baz', 2], 2),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 1, timestamp1, [
          { p: 3, i: 'foo' },
        ])
      )
      this.doc.length += 3

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 2, timestamp2, [
          { p: 6, i: 'baz' },
        ])
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createChange.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })

    it('should not concat updates with different user_ids', async function () {
      const userId1 = new ObjectId().toString()
      const userId2 = new ObjectId().toString()

      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olTextUpdate(this.doc, userId1, this.timestamp, [3, 'foo', 2], 1),
            olTextUpdate(this.doc, userId2, this.timestamp, [6, 'baz', 2], 2),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, userId1, 1, this.timestamp, [
          { p: 3, i: 'foo' },
        ])
      )
      this.doc.length += 3

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, userId2, 2, this.timestamp, [
          { p: 6, i: 'baz' },
        ])
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createChange.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })

    it('should not concat updates with different docs', async function () {
      const doc1 = {
        id: new ObjectId().toString(),
        pathname: '/doc1.tex',
        length: 10,
      }
      const doc2 = {
        id: new ObjectId().toString(),
        pathname: '/doc2.tex',
        length: 10,
      }

      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olTextUpdate(doc1, this.userId, this.timestamp, [3, 'foo', 7], 1),
            olTextUpdate(doc2, this.userId, this.timestamp, [6, 'baz', 4], 2),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, doc1, this.userId, 1, this.timestamp, [
          { p: 3, i: 'foo' },
        ])
      )

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, doc2, this.userId, 2, this.timestamp, [
          { p: 6, i: 'baz' },
        ])
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createChange.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })

    it('should not send updates without any ops', async function () {
      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      // These blank ops can get sent by doc-updater on setDocs from Dropbox that don't change anything
      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 1, this.timestamp, [])
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        !createChange.isDone(),
        `/api/projects/${historyId}/changes should not have been called`
      )
    })

    it('should not send ops that compress to nothing', async function () {
      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 1, this.timestamp, [
          { i: 'foo', p: 3 },
        ])
      )
      this.doc.length += 3

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 2, this.timestamp, [
          { d: 'foo', p: 3 },
        ])
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        !createChange.isDone(),
        `/api/projects/${historyId}/changes should not have been called`
      )
    })

    it('should not send ops from a diff that are blank', async function () {
      this.doc.length = 300
      // Test case taken from a real life document where it was generating blank insert and
      // delete ops from a diff, and the blank delete was erroring on the OL history from
      // a text operation like [42, 0, 512], where the 0 was invalid.
      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olTextUpdates(this.doc, this.userId, this.timestamp, [
              [
                87,
                -1,
                67,
                '|l|ll|}\n\\hline',
                -4,
                30,
                ' \\hline',
                87,
                ' \\\\ \\hline',
                24,
              ],
            ]),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 1, this.timestamp, [
          {
            p: 73,
            d: '\\begin{table}[h]\n\\centering\n\\caption{My caption}\n\\label{my-label}\n\\begin{tabular}{lll}\n               & A   & B   \\\\\nLiter t up     & 2   & 1   \\\\\nLiter Whiskey  & 1   & 2   \\\\\nPris pr. liter & 200 & 250\n\\end{tabular}\n\\end{table}',
          },
          {
            p: 73,
            i: '\\begin{table}[]\n\\centering\n\\caption{My caption}\n\\label{my-label}\n\\begin{tabular}{|l|ll|}\n\\hline\n               & A   & B   \\\\ \\hline\nLiter t up     & 2   & 1   \\\\\nLiter Whiskey  & 1   & 2   \\\\\nPris pr. liter & 200 & 250 \\\\ \\hline\n\\end{tabular}\n\\end{table}',
          },
        ])
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createChange.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })

    it('should not concat text updates across project structure ops', async function () {
      const newDoc = {
        id: new ObjectId().toString(),
        pathname: '/main.tex',
        hash: '0a207c060e61f3b88eaee0a8cd0696f46fb155eb',
        docLines: 'a\nb',
      }

      MockHistoryStore()
        .put(`/api/projects/${historyId}/blobs/${newDoc.hash}`)
        .reply(201)

      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olTextUpdate(
              this.doc,
              this.userId,
              this.timestamp,
              [3, 'foo', 2],
              1
            ),
            olAddDocUpdate(newDoc, this.userId, this.timestamp, newDoc.hash),
            olTextUpdate(
              this.doc,
              this.userId,
              this.timestamp,
              [6, 'baz', 2],
              2
            ),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 1, this.timestamp, [
          { p: 3, i: 'foobar' },
          { p: 6, d: 'bar' },
        ])
      )
      this.doc.length += 3

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slAddDocUpdate(
          historyId,
          newDoc,
          this.userId,
          this.timestamp,
          newDoc.docLines
        )
      )

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 2, this.timestamp, [
          { p: 6, i: 'baz' },
        ])
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createChange.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })

    it('should track the doc length when splitting ops', async function () {
      this.doc.length = 10

      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olTextUpdate(this.doc, this.userId, this.timestamp, [3, -3, 4], 1),
            olTextUpdate(
              this.doc,
              this.userId,
              this.timestamp,
              [3, 'barbaz', 4],
              2
            ), // This has a base length of 10
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 1, this.timestamp, [
          { p: 3, d: 'foo' },
          { p: 3, i: 'bar' }, // Make sure the length of the op generated from this is 7, not 10
        ])
      )

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 2, this.timestamp, [
          { p: 6, i: 'baz' },
        ])
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createChange.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })
  })

  describe('with bad pathnames', function () {
    beforeEach(function () {
      MockHistoryStore()
        .get(`/api/projects/${historyId}/latest/history`)
        .reply(200, {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {},
              changes: [],
            },
          },
        })
    })

    it('should replace \\\\ with _ and workaround * in pathnames', async function () {
      const doc = {
        id: this.doc.id,
        pathname: '\\main.tex',
        hash: 'b07b6b7a27667965f733943737124395c7577bea',
        docLines: 'aaabbbccc',
        length: 9,
      }

      MockHistoryStore()
        .put(`/api/projects/${historyId}/blobs/${doc.hash}`)
        .reply(201)

      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olAddDocUpdate(
              { id: doc.id, pathname: '_main.tex' },
              this.userId,
              this.timestamp,
              doc.hash
            ),
            olRenameUpdate(
              { id: doc.id, pathname: '_main.tex' },
              this.userId,
              this.timestamp,
              '_main.tex',
              '_main2.tex'
            ),
            olTextUpdate(
              { id: doc.id, pathname: '_main2.tex' },
              this.userId,
              this.timestamp,
              [3, 'foo', 6],
              2
            ),
            olRenameUpdate(
              { id: doc.id, pathname: '_main2.tex' },
              this.userId,
              this.timestamp,
              '_main2.tex',
              '_main__ASTERISK__.tex'
            ),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slAddDocUpdate(
          historyId,
          doc,
          this.userId,
          this.timestamp,
          doc.docLines
        )
      )

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slRenameUpdate(
          historyId,
          doc,
          this.userId,
          this.timestamp,
          '/\\main.tex',
          '/\\main2.tex'
        )
      )
      doc.pathname = '\\main2.tex'

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, doc, this.userId, 2, this.timestamp, [
          { p: 3, i: 'foo' },
        ])
      )

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slRenameUpdate(
          historyId,
          doc,
          this.userId,
          this.timestamp,
          '/\\main2.tex',
          '/\\main*.tex'
        )
      )
      doc.pathname = '\\main*.tex'

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createChange.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })

    it('should workaround pathnames beginning with spaces', async function () {
      const doc = {
        id: this.doc.id,
        pathname: 'main.tex',
        hash: 'b07b6b7a27667965f733943737124395c7577bea',
        docLines: 'aaabbbccc',
        length: 9,
      }

      MockHistoryStore()
        .put(`/api/projects/${historyId}/blobs/${doc.hash}`)
        .reply(201)

      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olAddDocUpdate(
              { id: doc.id, pathname: 'main.tex' },
              this.userId,
              this.timestamp,
              doc.hash
            ),
            olRenameUpdate(
              { id: doc.id },
              this.userId,
              this.timestamp,
              'main.tex',
              'foo/__SPACE__main.tex'
            ),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slAddDocUpdate(
          historyId,
          doc,
          this.userId,
          this.timestamp,
          doc.docLines
        )
      )

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slRenameUpdate(
          historyId,
          doc,
          this.userId,
          this.timestamp,
          '/main.tex',
          '/foo/ main.tex'
        )
      )
      doc.pathname = '/foo/ main.tex'

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createChange.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })
  })

  describe('with bad response from filestore', function () {
    beforeEach(function () {
      MockHistoryStore()
        .get(`/api/projects/${historyId}/latest/history`)
        .reply(200, {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {},
              changes: [],
            },
          },
        })
    })

    it('should return a 500 if the filestore returns a 500', async function () {
      const file = {
        id: new ObjectId().toString(),
        pathname: '/test.png',
        contents: Buffer.from([1, 2, 3]),
        hash: 'aed2973e4b8a7ff1b30ff5c4751e5a2b38989e74',
      }

      const fileStoreRequest = MockFileStore()
        .get(`/project/${this.projectId}/file/${file.id}`)
        .reply(500)

      const createBlob = MockHistoryStore()
        .put(`/api/projects/${historyId}/blobs/${file.hash}`, file.contents)
        .reply(201)

      const addFile = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olAddFileUpdate(file, this.userId, this.timestamp, file.hash),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slAddFileUpdate(
          historyId,
          file,
          this.userId,
          this.timestamp,
          this.projectId
        )
      )

      const res = await ProjectHistoryClient.flushProject(this.projectId, {
        allowErrors: true,
      })
      expect(res.statusCode).to.equal(500)

      assert(
        fileStoreRequest.isDone(),
        `/project/${this.projectId}/file/${file.id} should have been called`
      )
      assert(
        !createBlob.isDone(),
        `/api/projects/${historyId}/latest/files should not have been called`
      )
      assert(
        !addFile.isDone(),
        `/api/projects/${historyId}/latest/files should not have been called`
      )
    })

    it('should return a 500 if the filestore request errors', async function () {
      const file = {
        id: new ObjectId().toString(),
        pathname: '/test.png',
        contents: Buffer.from([1, 2, 3]),
        hash: 'aed2973e4b8a7ff1b30ff5c4751e5a2b38989e74',
      }

      const fileStoreRequest = MockFileStore()
        .get(`/project/${this.projectId}/file/${file.id}`)
        .replyWithError('oh no!')

      const createBlob = MockHistoryStore()
        .put(`/api/projects/${historyId}/blobs/${file.hash}`, file.contents)
        .reply(201)

      const addFile = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olAddFileUpdate(file, this.userId, this.timestamp, file.hash),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slAddFileUpdate(
          historyId,
          file,
          this.userId,
          this.timestamp,
          this.projectId
        )
      )

      const res = await ProjectHistoryClient.flushProject(this.projectId, {
        allowErrors: true,
      })
      expect(res.statusCode).to.equal(500)

      assert(
        fileStoreRequest.isDone(),
        `/project/${this.projectId}/file/${file.id} should have been called`
      )
      assert(
        !createBlob.isDone(),
        `/api/projects/${historyId}/latest/files should not have been called`
      )
      assert(
        !addFile.isDone(),
        `/api/projects/${historyId}/latest/files should not have been called`
      )
    })
  })

  describe('with an existing projectVersion field', function () {
    beforeEach(function () {
      MockHistoryStore()
        .get(`/api/projects/${historyId}/latest/history`)
        .reply(200, {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: { projectVersion: '100.0' },
              changes: [],
            },
          },
        })
    })

    it('should discard project structure updates which have already been applied', async function () {
      const newDoc = []
      for (let i = 0; i <= 2; i++) {
        newDoc[i] = {
          id: new ObjectId().toString(),
          pathname: `/main${i}.tex`,
          hash: '0a207c060e61f3b88eaee0a8cd0696f46fb155eb',
          docLines: 'a\nb',
        }
      }

      MockHistoryStore()
        .put(`/api/projects/${historyId}/blobs/${newDoc[0].hash}`)
        .times(3)
        .reply(201)

      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olAddDocUpdateWithVersion(
              newDoc[1],
              this.userId,
              this.timestamp,
              newDoc[1].hash,
              '101.0'
            ),
            olAddDocUpdateWithVersion(
              newDoc[2],
              this.userId,
              this.timestamp,
              newDoc[2].hash,
              '102.0'
            ),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slAddDocUpdateWithVersion(
          historyId,
          newDoc[0],
          this.userId,
          this.timestamp,
          newDoc[0].docLines,
          '100.0'
        )
      )

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slAddDocUpdateWithVersion(
          historyId,
          newDoc[1],
          this.userId,
          this.timestamp,
          newDoc[1].docLines,
          '101.0'
        )
      )

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slAddDocUpdateWithVersion(
          historyId,
          newDoc[2],
          this.userId,
          this.timestamp,
          newDoc[2].docLines,
          '102.0'
        )
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createChange.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })
  })

  describe('with an existing docVersions field', function () {
    beforeEach(function () {
      MockHistoryStore()
        .get(`/api/projects/${historyId}/latest/history`)
        .reply(200, {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: { v2DocVersions: { [this.doc.id]: { v: 100 } } }, // version 100 below already applied
              changes: [],
            },
          },
        })
    })

    it('should discard doc updates which have already been applied', async function () {
      const createChange = MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          expect(body).to.deep.equal([
            olTextUpdate(
              this.doc,
              this.userId,
              this.timestamp,
              [6, 'baz', 2],
              101
            ),
          ])
          return true
        })
        .query({ end_version: 0 })
        .reply(204)

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 100, this.timestamp, [
          { p: 3, i: 'foobar' }, // these ops should be skipped
          { p: 6, d: 'bar' },
        ])
      )
      this.doc.length += 3

      await ProjectHistoryClient.pushRawUpdate(
        this.projectId,
        slTextUpdate(historyId, this.doc, this.userId, 101, this.timestamp, [
          { p: 6, i: 'baz' }, // this op should be applied
        ])
      )

      await ProjectHistoryClient.flushProject(this.projectId)

      assert(
        createChange.isDone(),
        `/api/projects/${historyId}/changes should have been called`
      )
    })
  })
})
