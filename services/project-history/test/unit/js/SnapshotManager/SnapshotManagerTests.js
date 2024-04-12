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

  describe('getLatestSnapshot', function () {
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
        this.data = await this.SnapshotManager.promises.getLatestSnapshot(
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
          this.SnapshotManager.promises.getLatestSnapshot(
            this.projectId,
            this.historyId
          )
        ).to.be.rejectedWith('undefined chunk')
      })
    })
  })
})
