import sinon from 'sinon'
import { expect } from 'chai'
import { strict as esmock } from 'esmock'
import Core from 'overleaf-editor-core'
import * as Errors from '../../../../app/js/Errors.js'

const MODULE_PATH = '../../../../app/js/SnapshotManager.js'

describe('SnapshotManager', function () {
  beforeEach(async function () {
    this.HistoryStoreManager = {
      getBlobStore: sinon.stub(),
      promises: {
        getChunkAtVersion: sinon.stub(),
        getMostRecentChunk: sinon.stub(),
        getProjectBlobStream: sinon.stub(),
      },
    }
    this.WebApiManager = {
      promises: {
        getHistoryId: sinon.stub(),
      },
    }
    this.SnapshotManager = await esmock(MODULE_PATH, {
      'overleaf-editor-core': Core,
      '../../../../app/js/HistoryStoreManager.js': this.HistoryStoreManager,
      '../../../../app/js/WebApiManager.js': this.WebApiManager,
      '../../../../app/js/Errors.js': Errors,
    })
    this.projectId = 'project-id-123'
    this.historyId = 'ol-project-id-123'
    this.callback = sinon.stub()
  })

  describe('getFileSnapshotStream', function () {
    beforeEach(function () {
      this.WebApiManager.promises.getHistoryId.resolves(this.historyId)
      this.ranges = {
        comments: [],
        trackedChanges: [
          {
            range: { pos: 4, length: 6 },
            tracking: {
              userId: 'user-1',
              ts: '2024-01-01T00:00:00.000Z',
              type: 'delete',
            },
          },
          {
            range: { pos: 35, length: 5 },
            tracking: {
              userId: 'user-1',
              ts: '2024-01-01T00:00:00.000Z',
              type: 'insert',
            },
          },
        ],
      }
      this.HistoryStoreManager.promises.getChunkAtVersion.resolves({
        chunk: {
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: '35c9bd86574d61dcadbce2fdd3d4a0684272c6ea',
                  stringLength: 41,
                },
                'file_with_ranges.tex': {
                  hash: '5d2781d78fa5a97b7bafa849fe933dfc9dc93eba',
                  rangesHash: '73061952d41ce54825e2fc1c36b4cf736d5fb62f',
                  stringLength: 41,
                },
                'binary.png': {
                  hash: 'c6654ea913979e13e22022653d284444f284a172',
                  byteLength: 41,
                },
              },
            },
            changes: [
              {
                operations: [
                  {
                    pathname: 'main.tex',
                    textOperation: [41, '\n\nSeven eight'],
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    pathname: 'main.tex',
                    textOperation: [54, ' nine'],
                  },
                ],
                timestamp: '2017-12-04T10:29:22.905Z',
                authors: [31],
              },
            ],
          },
          startVersion: 3,
          authors: [
            {
              id: 31,
              email: 'james.allen@overleaf.com',
              name: 'James',
            },
          ],
        },
      })
    })

    describe('of a text file with no tracked changes', function () {
      beforeEach(async function () {
        this.HistoryStoreManager.getBlobStore.withArgs(this.historyId).returns({
          getString: (this.getString = sinon.stub().resolves(
            `\
Hello world

One two three

Four five six\
`.replace(/^\t/g, '')
          )),
          getObject: sinon.stub().rejects(),
        })
        this.stream = await this.SnapshotManager.promises.getFileSnapshotStream(
          this.projectId,
          5,
          'main.tex'
        )
      })

      it('should get the overleaf id', function () {
        this.WebApiManager.promises.getHistoryId
          .calledWith(this.projectId)
          .should.equal(true)
      })

      it('should get the chunk', function () {
        this.HistoryStoreManager.promises.getChunkAtVersion
          .calledWith(this.projectId, this.historyId, 5)
          .should.equal(true)
      })

      it('should get the blob of the starting snapshot', function () {
        this.getString
          .calledWith('35c9bd86574d61dcadbce2fdd3d4a0684272c6ea')
          .should.equal(true)
      })

      it('should return a string stream with the text content', function () {
        expect(this.stream.read().toString()).to.equal(
          `\
Hello world

One two three

Four five six

Seven eight nine\
`.replace(/^\t/g, '')
        )
      })

      describe('on blob store error', function () {
        beforeEach(function () {
          this.error = new Error('ESOCKETTIMEDOUT')
          this.HistoryStoreManager.getBlobStore
            .withArgs(this.historyId)
            .returns({
              getString: sinon.stub().rejects(this.error),
              getObject: sinon.stub().rejects(this.error),
            })
        })

        it('should call back with error', async function () {
          await expect(
            this.SnapshotManager.promises.getFileSnapshotStream(
              this.projectId,
              5,
              'main.tex'
            )
          ).to.be.rejectedWith(this.error)
        })
      })
    })

    describe('of a text file with tracked changes', function () {
      beforeEach(async function () {
        this.HistoryStoreManager.getBlobStore.withArgs(this.historyId).returns({
          getString: (this.getString = sinon
            .stub()
            .resolves('the quick brown fox jumps over the lazy dog')),
          getObject: (this.getObject = sinon.stub().resolves(this.ranges)),
        })
        this.stream = await this.SnapshotManager.promises.getFileSnapshotStream(
          this.projectId,
          5,
          'file_with_ranges.tex'
        )
      })

      it('should get the overleaf id', function () {
        this.WebApiManager.promises.getHistoryId
          .calledWith(this.projectId)
          .should.equal(true)
      })

      it('should get the chunk', function () {
        this.HistoryStoreManager.promises.getChunkAtVersion
          .calledWith(this.projectId, this.historyId, 5)
          .should.equal(true)
      })

      it('should get the blob of the starting snapshot', function () {
        this.getString
          .calledWith('5d2781d78fa5a97b7bafa849fe933dfc9dc93eba')
          .should.equal(true)
      })

      it('should get the blob of the ranges', function () {
        this.getObject
          .calledWith('73061952d41ce54825e2fc1c36b4cf736d5fb62f')
          .should.equal(true)
      })

      it('should return a string stream with the text content without the tracked deletes', function () {
        expect(this.stream.read().toString()).to.equal(
          'the brown fox jumps over the lazy dog'
        )
      })
    })

    describe('of a binary file', function () {
      beforeEach(async function () {
        this.HistoryStoreManager.promises.getProjectBlobStream
          .withArgs(this.historyId)
          .resolves((this.stream = 'mock-stream'))
        this.returnedStream =
          await this.SnapshotManager.promises.getFileSnapshotStream(
            this.projectId,
            5,
            'binary.png'
          )
      })

      it('should get the overleaf id', function () {
        this.WebApiManager.promises.getHistoryId
          .calledWith(this.projectId)
          .should.equal(true)
      })

      it('should get the chunk', function () {
        this.HistoryStoreManager.promises.getChunkAtVersion
          .calledWith(this.projectId, this.historyId, 5)
          .should.equal(true)
      })

      it('should get the blob of the starting snapshot', function () {
        this.HistoryStoreManager.promises.getProjectBlobStream
          .calledWith(
            this.historyId,
            'c6654ea913979e13e22022653d284444f284a172'
          )
          .should.equal(true)
      })

      it('should return a stream with the blob content', function () {
        expect(this.returnedStream).to.equal(this.stream)
      })
    })

    describe("when the file doesn't exist", function () {
      it('should return a NotFoundError', async function () {
        await expect(
          this.SnapshotManager.promises.getFileSnapshotStream(
            this.projectId,
            5,
            'not-here.png'
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })
  })

  describe('getProjectSnapshot', function () {
    beforeEach(function () {
      this.WebApiManager.promises.getHistoryId.resolves(this.historyId)
      this.ranges = {
        comments: [],
        trackedChanges: [
          {
            range: { pos: 5, length: 6 },
            tracking: {
              userId: 'user-1',
              ts: '2024-01-01T00:00:00.000Z',
              type: 'delete',
            },
          },
          {
            range: { pos: 12, length: 5 },
            tracking: {
              userId: 'user-1',
              ts: '2024-01-01T00:00:00.000Z',
              type: 'insert',
            },
          },
        ],
      }
      this.HistoryStoreManager.promises.getChunkAtVersion.resolves({
        chunk: (this.chunk = {
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: '35c9bd86574d61dcadbce2fdd3d4a0684272c6ea',
                  stringLength: 41,
                },
                'unchanged.tex': {
                  hash: '35c9bd86574d61dcadbce2fdd3d4a0684272c6ea',
                  stringLength: 41,
                },
                'with_ranges_unchanged.tex': {
                  hash: '35c9bd86574d61dcadbce2fdd3d4a0684272c6ea',
                  rangesHash: '2e59fe3dbd5310703f89236d589d0b35db169cdf',
                  stringLength: 41,
                },
                'with_ranges_changed.tex': {
                  hash: '35c9bd86574d61dcadbce2fdd3d4a0684272c6ea',
                  rangesHash: '2e59fe3dbd5310703f89236d589d0b35db169cdf',
                  stringLength: 41,
                },
                'binary.png': {
                  hash: 'c6654ea913979e13e22022653d284444f284a172',
                  byteLength: 41,
                },
              },
            },
            changes: [
              {
                operations: [
                  {
                    pathname: 'main.tex',
                    textOperation: [41, '\n\nSeven eight'],
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    pathname: 'main.tex',
                    textOperation: [54, ' nine'],
                  },
                ],
                timestamp: '2017-12-04T10:29:22.905Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    pathname: 'with_ranges_changed.tex',
                    textOperation: [41, '\n\nSeven eight'],
                  },
                ],
                timestamp: '2017-12-04T10:29:25.905Z',
                authors: [31],
              },
            ],
          },
          startVersion: 3,
          authors: [
            {
              id: 31,
              email: 'james.allen@overleaf.com',
              name: 'James',
            },
          ],
        }),
      })
    })

    describe('of project', function () {
      beforeEach(async function () {
        this.HistoryStoreManager.getBlobStore.withArgs(this.historyId).returns({
          getString: (this.getString = sinon.stub().resolves(
            `\
Hello world

One two three

Four five six\
`
          )),
          getObject: (this.getObject = sinon.stub().resolves(this.ranges)),
        })
        this.data = await this.SnapshotManager.promises.getProjectSnapshot(
          this.projectId,
          6
        )
      })

      it('should get the overleaf id', function () {
        this.WebApiManager.promises.getHistoryId
          .calledWith(this.projectId)
          .should.equal(true)
      })

      it('should get the chunk', function () {
        this.HistoryStoreManager.promises.getChunkAtVersion
          .calledWith(this.projectId, this.historyId, 6)
          .should.equal(true)
      })

      it('should get the ranges for the file with tracked changes', function () {
        this.getObject.calledWith('2e59fe3dbd5310703f89236d589d0b35db169cdf')
      })

      it('should produce the snapshot file data', function () {
        expect(this.data).to.deep.equal({
          files: {
            'main.tex': {
              // files with operations in the chunk should return content only
              data: {
                content:
                  'Hello world\n\nOne two three\n\nFour five six\n\nSeven eight nine',
              },
            },
            'unchanged.tex': {
              // unchanged files in the chunk should return hash only
              data: {
                hash: '35c9bd86574d61dcadbce2fdd3d4a0684272c6ea',
              },
            },
            'with_ranges_changed.tex': {
              // files in the chunk with tracked changes should return content
              // without the tracked deletes
              data: {
                content:
                  'Hello\n\nOne two three\n\nFour five six\n\nSeven eight',
              },
            },
            'with_ranges_unchanged.tex': {
              // files in the chunk with tracked changes should return content
              // without the tracked deletes, even if they are unchanged
              data: {
                content: 'Hello\n\nOne two three\n\nFour five six',
              },
            },
            'binary.png': {
              // binary files in the chunk should return hash only
              data: {
                hash: 'c6654ea913979e13e22022653d284444f284a172',
              },
            },
          },
          projectId: 'project-id-123',
        })
      })
    })

    describe('on blob store error', function () {
      beforeEach(function () {
        this.error = new Error('ESOCKETTIMEDOUT')
        this.HistoryStoreManager.getBlobStore.withArgs(this.historyId).returns({
          getString: sinon.stub().rejects(this.error),
          getObject: sinon.stub().resolves(),
        })
      })

      it('should call back with error', async function () {
        expect(
          this.SnapshotManager.promises.getProjectSnapshot(this.projectId, 5)
        ).to.be.rejectedWith(this.error.message)
      })
    })
  })

  describe('getLatestSnapshotFiles', function () {
    describe('for a project', function () {
      beforeEach(async function () {
        this.HistoryStoreManager.promises.getMostRecentChunk.resolves({
          chunk: (this.chunk = {
            history: {
              snapshot: {
                files: {
                  'main.tex': {
                    hash: '35c9bd86574d61dcadbce2fdd3d4a0684272c6ea',
                    stringLength: 41,
                  },
                  'binary.png': {
                    hash: 'c6654ea913979e13e22022653d284444f284a172',
                    byteLength: 41,
                  },
                },
              },
              changes: [
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [41, '\n\nSeven eight'],
                    },
                  ],
                  timestamp: '2017-12-04T10:29:17.786Z',
                  authors: [31],
                },
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [54, ' nine'],
                    },
                  ],
                  timestamp: '2017-12-04T10:29:22.905Z',
                  authors: [31],
                },
              ],
            },
            startVersion: 3,
            authors: [
              {
                id: 31,
                email: 'james.allen@overleaf.com',
                name: 'James',
              },
            ],
          }),
        })

        this.HistoryStoreManager.getBlobStore.withArgs(this.historyId).returns({
          getString: (this.getString = sinon.stub().resolves(
            `\
Hello world

One two three

Four five six\
`.replace(/^\t/g, '')
          )),
          getObject: sinon.stub().rejects(),
        })
        this.data = await this.SnapshotManager.promises.getLatestSnapshotFiles(
          this.projectId,
          this.historyId
        )
      })

      it('should get the chunk', function () {
        this.HistoryStoreManager.promises.getMostRecentChunk
          .calledWith(this.projectId, this.historyId)
          .should.equal(true)
      })

      it('should produce the snapshot file data', function () {
        expect(this.data).to.have.all.keys(['main.tex', 'binary.png'])
        expect(this.data['main.tex']).to.exist
        expect(this.data['binary.png']).to.exist
        expect(this.data['main.tex'].getStringLength()).to.equal(59)
        expect(this.data['binary.png'].getByteLength()).to.equal(41)
        expect(this.data['binary.png'].getHash()).to.equal(
          'c6654ea913979e13e22022653d284444f284a172'
        )
      })
    })

    describe('when the chunk is empty', function () {
      beforeEach(async function () {
        this.HistoryStoreManager.promises.getMostRecentChunk.resolves(null)
        expect(
          this.SnapshotManager.promises.getLatestSnapshotFiles(
            this.projectId,
            this.historyId
          )
        ).to.be.rejectedWith('undefined chunk')
      })
    })
  })

  describe('getRangesSnapshot', function () {
    beforeEach(async function () {
      this.WebApiManager.promises.getHistoryId.resolves(this.historyId)
      this.HistoryStoreManager.promises.getChunkAtVersion.resolves({
        chunk: (this.chunk = {
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: (this.fileHash =
                    '5d2781d78fa5a97b7bafa849fe933dfc9dc93eba'),
                  rangesHash: (this.rangesHash =
                    '73061952d41ce54825e2fc1c36b4cf736d5fb62f'),
                  stringLength: 41,
                },
              },
            },
            changes: [],
          },
          startVersion: 1,
          authors: [
            {
              id: 31,
              email: 'author@example.com',
              name: 'Author',
            },
          ],
        }),
      })

      this.HistoryStoreManager.getBlobStore.withArgs(this.historyId).returns({
        getString: (this.getString = sinon.stub()),
        getObject: (this.getObject = sinon.stub()),
      })

      this.getString.resolves('the quick brown fox jumps over the lazy dog')
    })

    describe('with tracked deletes', function () {
      beforeEach(async function () {
        this.getObject.resolves({
          trackedChanges: [
            {
              // 'quick '
              range: {
                pos: 4,
                length: 6,
              },
              tracking: {
                type: 'delete',
                userId: '31',
                ts: '2023-01-01T00:00:00.000Z',
              },
            },
            {
              // 'fox '
              range: {
                pos: 16,
                length: 4,
              },
              tracking: {
                type: 'delete',
                userId: '31',
                ts: '2023-01-01T00:00:00.000Z',
              },
            },
            {
              // 'lazy '
              range: {
                pos: 35,
                length: 5,
              },
              tracking: {
                type: 'insert',
                userId: '31',
                ts: '2023-01-01T00:00:00.000Z',
              },
            },
            {
              // 'dog'
              range: {
                pos: 40,
                length: 3,
              },
              tracking: {
                type: 'delete',
                userId: '31',
                ts: '2023-01-01T00:00:00.000Z',
              },
            },
          ],
        })
        this.data = await this.SnapshotManager.promises.getRangesSnapshot(
          this.projectId,
          1,
          'main.tex'
        )
      })

      it("doesn't shift the tracked delete by itself", function () {
        expect(this.data.changes[0].op.p).to.eq(4)
      })

      it('should move subsequent tracked changes by the length of previous deletes', function () {
        expect(this.data.changes[1].op.p).to.eq(16 - 6)
        expect(this.data.changes[2].op.p).to.eq(35 - 6 - 4)
      })

      it("shouldn't move subsequent tracked changes by previous inserts", function () {
        expect(this.data.changes[3].op.p).to.eq(40 - 6 - 4)
      })
    })

    describe('with comments and tracked deletes', function () {
      beforeEach(async function () {
        this.getObject.resolves({
          // the quick brown fox jumps over the lazy dog
          trackedChanges: [
            {
              // 'e qui'
              range: {
                pos: 2,
                length: 5,
              },
              tracking: {
                type: 'delete',
                userId: '31',
                ts: '2023-01-01T00:00:00.000Z',
              },
            },
            {
              // 'r'
              range: {
                pos: 11,
                length: 1,
              },
              tracking: {
                type: 'delete',
                userId: '31',
                ts: '2023-01-01T00:00:00.000Z',
              },
            },
            {
              // 'er the la'
              range: {
                pos: 28,
                length: 9,
              },
              tracking: {
                type: 'delete',
                userId: '31',
                ts: '2023-01-01T00:00:00.000Z',
              },
            },
          ],
          comments: [
            {
              id: 'comment-1',
              ranges: [
                // 'quick'
                {
                  pos: 4,
                  length: 5,
                },
                // 'brown'
                {
                  pos: 10,
                  length: 5,
                },
                // 'over'
                {
                  pos: 26,
                  length: 4,
                },
                // 'lazy'
                {
                  pos: 35,
                  length: 4,
                },
              ],
              resolved: false,
            },
            { id: 'comment-2', ranges: [], resolved: true },
            {
              id: 'comment-3',
              ranges: [
                // 'q'
                { pos: 4, length: 1 },
              ],
              resolved: true,
            },
          ],
        })
        this.data = await this.SnapshotManager.promises.getRangesSnapshot(
          this.projectId,
          1,
          'main.tex'
        )
      })

      it('should move the comment to the start of the tracked delete and remove overlapping text', function () {
        expect(this.data.comments[0].op.p).to.eq(2)
        expect(this.data.comments[0].op.c).to.eq('ck bown fox jumps ovzy')
      })

      it('should put resolved status in op', function () {
        expect(this.data.comments[0].op.resolved).to.be.false
        expect(this.data.comments[1].op.resolved).to.be.true
        expect(this.data.comments[2].op.resolved).to.be.true
      })

      it('should include thread id', function () {
        expect(this.data.comments[0].op.t).to.eq('comment-1')
        expect(this.data.comments[1].op.t).to.eq('comment-2')
        expect(this.data.comments[2].op.t).to.eq('comment-3')
      })

      it('should translate detached comment to zero length op', function () {
        expect(this.data.comments[1].op.p).to.eq(0)
        expect(this.data.comments[1].op.c).to.eq('')
      })

      it('should position a comment entirely in a tracked delete next to the tracked delete', function () {
        expect(this.data.comments[2].op.p).to.eq(2)
        expect(this.data.comments[2].op.c).to.eq('')
      })
    })

    describe('with multiple tracked changes and comments', function () {
      beforeEach(async function () {
        this.getObject.resolves({
          trackedChanges: [
            {
              // 'quick '
              range: {
                pos: 4,
                length: 6,
              },
              tracking: {
                type: 'delete',
                userId: '31',
                ts: '2023-01-01T00:00:00.000Z',
              },
            },
            {
              // 'brown '
              range: {
                pos: 10,
                length: 6,
              },
              tracking: {
                type: 'insert',
                userId: '31',
                ts: '2024-01-01T00:00:00.000Z',
              },
            },
            {
              // 'lazy '
              range: {
                pos: 35,
                length: 5,
              },
              tracking: {
                type: 'delete',
                userId: '31',
                ts: '2024-01-01T00:00:00.000Z',
              },
            },
          ],
          comments: [
            {
              id: 'comment-1',
              // 'quick', 'brown', 'lazy'
              ranges: [
                {
                  pos: 4,
                  length: 5,
                },
                {
                  pos: 10,
                  length: 5,
                },
                {
                  pos: 35,
                  length: 4,
                },
              ],
              resolved: false,
            },
            {
              id: 'comment-2',
              // 'the', 'the'
              ranges: [
                {
                  pos: 0,
                  length: 3,
                },
                {
                  pos: 31,
                  length: 3,
                },
              ],
              resolved: true,
            },
          ],
        })

        this.data = await this.SnapshotManager.promises.getRangesSnapshot(
          this.projectId,
          1,
          'main.tex'
        )
      })

      it('looks up ranges', function () {
        expect(this.getObject).to.have.been.calledWith(this.rangesHash)
        expect(this.getString).to.have.been.calledWith(this.fileHash)
      })

      it('should get the chunk', function () {
        expect(
          this.HistoryStoreManager.promises.getChunkAtVersion
        ).to.have.been.calledWith(this.projectId, this.historyId, 1)
      })

      it('returns the ranges with content and adjusted positions to ignore tracked deletes', function () {
        expect(this.data).to.deep.equal({
          changes: [
            {
              metadata: {
                ts: '2023-01-01T00:00:00.000Z',
                user_id: '31',
              },
              op: {
                d: 'quick ',
                p: 4,
              },
            },
            {
              metadata: {
                ts: '2024-01-01T00:00:00.000Z',
                user_id: '31',
              },
              op: {
                i: 'brown ',
                p: 4,
              },
            },
            {
              metadata: {
                ts: '2024-01-01T00:00:00.000Z',
                user_id: '31',
              },
              op: {
                d: 'lazy ',
                p: 29,
              },
            },
          ],
          comments: [
            {
              op: {
                c: 'brown fox jumps over the ',
                p: 4,
                t: 'comment-1',
                resolved: false,
              },
              id: 'comment-1',
            },
            {
              op: {
                c: 'the brown fox jumps over the',
                p: 0,
                t: 'comment-2',
                resolved: true,
              },
              id: 'comment-2',
            },
          ],
        })
      })
    })

    describe('with an empty file', function () {
      beforeEach(async function () {
        this.getString.resolves('')
        this.getObject.resolves({})
        this.data = await this.SnapshotManager.promises.getRangesSnapshot(
          this.projectId,
          1,
          'main.tex'
        )
      })

      it('should return empty comments and changes', function () {
        expect(this.data).to.deep.equal({
          changes: [],
          comments: [],
        })
      })
    })
  })

  describe('getFileMetadataSnapshot', function () {
    beforeEach(function () {
      this.WebApiManager.promises.getHistoryId.resolves(this.historyId)
      this.HistoryStoreManager.promises.getChunkAtVersion.resolves({
        chunk: (this.chunk = {
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: '5d2781d78fa5a97b7bafa849fe933dfc9dc93eba',
                  metadata: {
                    importer_id: 'test-user-id',
                    imported_at: '2024-01-01T00:00:00.000Z',
                  },
                  stringLength: 41,
                },
                'other.tex': {
                  hash: '5d2781d78fa5a97b7bafa849fe933dfc9dc93eba',
                  stringLength: 41,
                },
              },
            },
            changes: [],
          },
          startVersion: 1,
          authors: [
            {
              id: 31,
              email: 'author@example.com',
              name: 'Author',
            },
          ],
        }),
      })
    })

    it('should return the metadata for the file', async function () {
      const result =
        await this.SnapshotManager.promises.getFileMetadataSnapshot(
          this.projectId,
          1,
          'main.tex'
        )
      expect(result).to.deep.equal({
        metadata: {
          importer_id: 'test-user-id',
          imported_at: '2024-01-01T00:00:00.000Z',
        },
      })
    })

    it('should return undefined when file does not have metadata', async function () {
      const result =
        await this.SnapshotManager.promises.getFileMetadataSnapshot(
          this.projectId,
          1,
          'other.tex'
        )
      expect(result).to.deep.equal({ metadata: undefined })
    })

    it('throw an error when file does not exist', async function () {
      await expect(
        this.SnapshotManager.promises.getFileMetadataSnapshot(
          this.projectId,
          1,
          'does-not-exist.tex'
        )
      ).to.be.rejectedWith(Error)
    })
  })

  describe('getPathsAtVersion', function () {
    beforeEach(function () {
      this.WebApiManager.promises.getHistoryId.resolves(this.historyId)
      this.HistoryStoreManager.promises.getChunkAtVersion.resolves({
        chunk: (this.chunk = {
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: (this.fileHash =
                    '5d2781d78fa5a97b7bafa849fe933dfc9dc93eba'),
                  rangesHash: (this.rangesHash =
                    '73061952d41ce54825e2fc1c36b4cf736d5fb62f'),
                  stringLength: 41,
                },
                'other.tex': {
                  hash: (this.fileHash =
                    'f572d396fae9206628714fb2ce00f72e94f2258f'),
                  stringLength: 6,
                },
              },
            },
            changes: [],
          },
          startVersion: 4,
          authors: [
            {
              id: 31,
              email: 'author@example.com',
              name: 'Author',
            },
          ],
        }),
      })
    })

    it('should return an array of paths', async function () {
      const result = await this.SnapshotManager.promises.getPathsAtVersion(
        this.projectId,
        4
      )
      expect(result.paths).to.have.length(2)
      expect(result.paths).to.include.members(['main.tex', 'other.tex'])
    })
  })
})
