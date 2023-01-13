import sinon from 'sinon'
import { expect } from 'chai'
import { strict as esmock } from 'esmock'

const MODULE_PATH = '../../../../app/js/DiffManager.js'

describe('DiffManager', function () {
  beforeEach(async function () {
    this.DocumentUpdaterManager = {}
    this.DiffGenerator = {
      buildDiff: sinon.stub(),
    }
    this.UpdatesProcessor = {
      processUpdatesForProject: sinon.stub(),
    }
    this.HistoryStoreManager = {
      getChunkAtVersion: sinon.stub(),
    }
    this.WebApiManager = {
      getHistoryId: sinon.stub(),
    }
    this.ChunkTranslator = {
      convertToDiffUpdates: sinon.stub(),
    }
    this.FileTreeDiffGenerator = {}
    this.DiffManager = await esmock(MODULE_PATH, {
      '../../../../app/js/DocumentUpdaterManager.js':
        this.DocumentUpdaterManager,
      '../../../../app/js/DiffGenerator.js': this.DiffGenerator,
      '../../../../app/js/UpdatesProcessor.js': this.UpdatesProcessor,
      '../../../../app/js/HistoryStoreManager.js': this.HistoryStoreManager,
      '../../../../app/js/WebApiManager.js': this.WebApiManager,
      '../../../../app/js/ChunkTranslator.js': this.ChunkTranslator,
      '../../../../app/js/FileTreeDiffGenerator.js': this.FileTreeDiffGenerator,
    })
    this.projectId = 'mock-project-id'
    this.callback = sinon.stub()
  })

  describe('getDiff', function () {
    beforeEach(function () {
      this.pathname = 'main.tex'
      this.fromVersion = 4
      this.toVersion = 8
      this.initialContent = 'foo bar baz'
      this.updates = ['mock-updates']
      this.diff = { mock: 'dif' }
      this.UpdatesProcessor.processUpdatesForProject
        .withArgs(this.projectId)
        .yields()
      this.DiffGenerator.buildDiff
        .withArgs(this.initialContent, this.updates)
        .returns(this.diff)
    })

    describe('with a text file', function () {
      beforeEach(function () {
        this.DiffManager._mocks._getProjectUpdatesBetweenVersions = sinon.stub()
        this.DiffManager._mocks._getProjectUpdatesBetweenVersions
          .withArgs(
            this.projectId,
            this.pathname,
            this.fromVersion,
            this.toVersion
          )
          .yields(null, {
            initialContent: this.initialContent,
            updates: this.updates,
          })
        this.DiffManager.getDiff(
          this.projectId,
          this.pathname,
          this.fromVersion,
          this.toVersion,
          this.callback
        )
      })

      it('should make sure all pending updates have been process', function () {
        this.UpdatesProcessor.processUpdatesForProject
          .calledWith(this.projectId)
          .should.equal(true)
      })

      it('should get the updates from the history backend', function () {
        this.DiffManager._mocks._getProjectUpdatesBetweenVersions
          .calledWith(
            this.projectId,
            this.pathname,
            this.fromVersion,
            this.toVersion
          )
          .should.equal(true)
      })

      it('should convert the updates to a diff', function () {
        this.DiffGenerator.buildDiff
          .calledWith(this.initialContent, this.updates)
          .should.equal(true)
      })

      it('should return the diff', function () {
        this.callback.calledWith(null, this.diff).should.equal(true)
      })
    })

    describe('with a binary file', function () {
      beforeEach(function () {
        this.DiffManager._mocks._getProjectUpdatesBetweenVersions = sinon.stub()
        this.DiffManager._mocks._getProjectUpdatesBetweenVersions
          .withArgs(
            this.projectId,
            this.pathname,
            this.fromVersion,
            this.toVersion
          )
          .yields(null, { binary: true })
        this.DiffManager.getDiff(
          this.projectId,
          this.pathname,
          this.fromVersion,
          this.toVersion,
          this.callback
        )
      })

      it('should make sure all pending updates have been process', function () {
        this.UpdatesProcessor.processUpdatesForProject
          .calledWith(this.projectId)
          .should.equal(true)
      })

      it('should get the updates from the history backend', function () {
        this.DiffManager._mocks._getProjectUpdatesBetweenVersions
          .calledWith(
            this.projectId,
            this.pathname,
            this.fromVersion,
            this.toVersion
          )
          .should.equal(true)
      })

      it('should not try convert any updates to a diff', function () {
        this.DiffGenerator.buildDiff.called.should.equal(false)
      })

      it('should return the binary diff', function () {
        this.callback.calledWith(null, { binary: true }).should.equal(true)
      })
    })
  })

  describe('_getProjectUpdatesBetweenVersions', function () {
    beforeEach(function () {
      this.pathname = 'main.tex'
      this.fromVersion = 4
      this.toVersion = 8
      this.chunks = ['mock-chunk-1', 'mock-chunk-2']
      this.concatted_chunk = 'mock-chunk'
      this.DiffManager._mocks._concatChunks = sinon.stub()
      this.DiffManager._mocks._concatChunks
        .withArgs(this.chunks)
        .returns(this.concatted_chunk)
      this.updates = ['mock-updates']
      this.initialContent = 'foo bar baz'
      this.ChunkTranslator.convertToDiffUpdates
        .withArgs(
          this.projectId,
          this.concatted_chunk,
          this.pathname,
          this.fromVersion,
          this.toVersion
        )
        .yields(null, {
          initialContent: this.initialContent,
          updates: this.updates,
        })
    })

    describe('for the normal case', function () {
      beforeEach(function () {
        this.DiffManager._mocks._getChunks = sinon.stub()
        this.DiffManager._mocks._getChunks
          .withArgs(this.projectId, this.fromVersion, this.toVersion)
          .yields(null, this.chunks)
        this.DiffManager._getProjectUpdatesBetweenVersions(
          this.projectId,
          this.pathname,
          this.fromVersion,
          this.toVersion,
          this.callback
        )
      })

      it('should get the relevant chunks', function () {
        this.DiffManager._mocks._getChunks
          .calledWith(this.projectId, this.fromVersion, this.toVersion)
          .should.equal(true)
      })

      it('should get the concat the chunks', function () {
        this.DiffManager._mocks._concatChunks
          .calledWith(this.chunks)
          .should.equal(true)
      })

      it('should convert the chunks to an initial version and updates', function () {
        this.ChunkTranslator.convertToDiffUpdates
          .calledWith(
            this.projectId,
            this.concatted_chunk,
            this.pathname,
            this.fromVersion,
            this.toVersion
          )
          .should.equal(true)
      })

      it('should return the initialContent and updates', function () {
        this.callback
          .calledWith(null, {
            initialContent: this.initialContent,
            updates: this.updates,
          })
          .should.equal(true)
      })
    })

    describe('for the error case', function () {
      beforeEach(function () {
        this.DiffManager._mocks._getChunks = sinon.stub()
        this.DiffManager._mocks._getChunks
          .withArgs(this.projectId, this.fromVersion, this.toVersion)
          .yields(new Error('failed to load chunk'))
        this.DiffManager._getProjectUpdatesBetweenVersions(
          this.projectId,
          this.pathname,
          this.fromVersion,
          this.toVersion,
          this.callback
        )
      })

      it('should call the callback with an error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })
  })

  describe('_getChunks', function () {
    beforeEach(function () {
      this.historyId = 'mock-overleaf-id'
      this.WebApiManager.getHistoryId.yields(null, this.historyId)
    })

    describe('where only one chunk is needed', function () {
      beforeEach(function (done) {
        this.fromVersion = 4
        this.toVersion = 8
        this.chunk = {
          chunk: {
            startVersion: 2,
          }, // before fromVersion
        }
        this.HistoryStoreManager.getChunkAtVersion
          .withArgs(this.projectId, this.historyId, this.toVersion)
          .yields(null, this.chunk)
        this.DiffManager._getChunks(
          this.projectId,
          this.fromVersion,
          this.toVersion,
          (error, chunks) => {
            this.error = error
            this.chunks = chunks
            done()
          }
        )
      })

      it("should the project's overleaf id", function () {
        this.WebApiManager.getHistoryId
          .calledWith(this.projectId)
          .should.equal(true)
      })

      it('should request the first chunk', function () {
        this.HistoryStoreManager.getChunkAtVersion
          .calledWith(this.projectId, this.historyId, this.toVersion)
          .should.equal(true)
      })

      it('should return an array of chunks', function () {
        expect(this.chunks).to.deep.equal([this.chunk])
      })
    })

    describe('where multiple chunks are needed', function () {
      beforeEach(function (done) {
        this.fromVersion = 4
        this.toVersion = 8
        this.chunk1 = {
          chunk: {
            startVersion: 6,
          },
        }
        this.chunk2 = {
          chunk: {
            startVersion: 2,
          },
        }
        this.HistoryStoreManager.getChunkAtVersion
          .withArgs(this.projectId, this.historyId, this.toVersion)
          .yields(null, this.chunk1)
        this.HistoryStoreManager.getChunkAtVersion
          .withArgs(
            this.projectId,
            this.historyId,
            this.chunk1.chunk.startVersion
          )
          .yields(null, this.chunk2)
        this.DiffManager._mocks._getChunks(
          this.projectId,
          this.fromVersion,
          this.toVersion,
          (error, chunks) => {
            this.error = error
            this.chunks = chunks
            done()
          }
        )
      })

      it('should request the first chunk', function () {
        this.HistoryStoreManager.getChunkAtVersion
          .calledWith(this.projectId, this.historyId, this.toVersion)
          .should.equal(true)
      })

      it('should request the second chunk, from where the first one started', function () {
        this.HistoryStoreManager.getChunkAtVersion
          .calledWith(
            this.projectId,
            this.historyId,
            this.chunk1.chunk.startVersion
          )
          .should.equal(true)
      })

      it('should return an array of chunks', function () {
        expect(this.chunks).to.deep.equal([this.chunk1, this.chunk2])
      })
    })

    describe('where more than MAX_CHUNKS are requested', function () {
      beforeEach(function (done) {
        this.fromVersion = 0
        this.toVersion = 8
        this.chunk1 = {
          chunk: {
            startVersion: 6,
          },
        }
        this.chunk2 = {
          chunk: {
            startVersion: 4,
          },
        }
        this.chunk3 = {
          chunk: {
            startVersion: 2,
          },
        }
        this.DiffManager.setMaxChunkRequests(2)
        this.HistoryStoreManager.getChunkAtVersion
          .withArgs(this.projectId, this.historyId, this.toVersion)
          .yields(null, this.chunk1)
        this.HistoryStoreManager.getChunkAtVersion
          .withArgs(
            this.projectId,
            this.historyId,
            this.chunk1.chunk.startVersion
          )
          .yields(null, this.chunk2)
        this.DiffManager._mocks._getChunks(
          this.projectId,
          this.fromVersion,
          this.toVersion,
          (error, chunks) => {
            this.error = error
            this.chunks = chunks
            done()
          }
        )
      })

      it('should request the first chunk', function () {
        this.HistoryStoreManager.getChunkAtVersion
          .calledWith(this.projectId, this.historyId, this.toVersion)
          .should.equal(true)
      })

      it('should request the second chunk, from where the first one started', function () {
        this.HistoryStoreManager.getChunkAtVersion
          .calledWith(
            this.projectId,
            this.historyId,
            this.chunk1.chunk.startVersion
          )
          .should.equal(true)
      })

      it('should not request the third chunk', function () {
        this.HistoryStoreManager.getChunkAtVersion
          .calledWith(
            this.projectId,
            this.historyId,
            this.chunk2.chunk.startVersion
          )
          .should.equal(false)
      })

      it('should return an error', function () {
        expect(this.error).to.exist
        expect(this.error.message).to.equal('Diff spans too many chunks')
        expect(this.error.name).to.equal('BadRequestError')
      })
    })

    describe('where fromVersion == toVersion', function () {
      beforeEach(function (done) {
        this.fromVersion = 4
        this.toVersion = 4
        this.chunk = {
          chunk: {
            startVersion: 2,
          }, // before fromVersion
        }
        this.HistoryStoreManager.getChunkAtVersion
          .withArgs(this.projectId, this.historyId, this.toVersion)
          .yields(null, this.chunk)
        this.DiffManager._mocks._getChunks(
          this.projectId,
          this.fromVersion,
          this.toVersion,
          (error, chunks) => {
            this.error = error
            this.chunks = chunks
            done()
          }
        )
      })

      it('should still request the first chunk (because we need the file contents)', function () {
        this.HistoryStoreManager.getChunkAtVersion
          .calledWith(this.projectId, this.historyId, this.toVersion)
          .should.equal(true)
      })

      it('should return an array of chunks', function () {
        expect(this.chunks).to.deep.equal([this.chunk])
      })
    })
  })

  describe('_concatChunks', function () {
    it('should concat the chunks in reverse order', function () {
      const result = this.DiffManager._mocks._concatChunks([
        {
          chunk: {
            history: {
              snapshot: {
                files: {
                  mock: 'files-updated-2',
                },
              },
              changes: [7, 8, 9],
            },
          },
        },
        {
          chunk: {
            history: {
              snapshot: {
                files: {
                  mock: 'files-updated',
                },
              },
              changes: [4, 5, 6],
            },
          },
        },
        {
          chunk: {
            history: {
              snapshot: {
                files: {
                  mock: 'files-original',
                },
              },
              changes: [1, 2, 3],
            },
          },
        },
      ])

      expect(result).to.deep.equal({
        chunk: {
          history: {
            snapshot: {
              files: {
                mock: 'files-original',
              },
            },
            changes: [1, 2, 3, 4, 5, 6, 7, 8, 9],
          },
        },
      })
    })
  })
})
