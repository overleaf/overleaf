import sinon from 'sinon'
import { expect } from 'chai'
import { strict as esmock } from 'esmock'
import EventEmitter from 'node:events'
import { RequestFailedError } from '@overleaf/fetch-utils'
import * as Errors from '../../../../app/js/Errors.js'

const MODULE_PATH = '../../../../app/js/HistoryStoreManager.js'

describe('HistoryStoreManager', function () {
  beforeEach(async function () {
    this.projectId = '123456789012345678901234'
    this.historyId = 'mock-ol-project-id'
    this.settings = {
      overleaf: {
        history: {
          host: 'http://example.com',
          user: 'overleaf',
          pass: 'password',
          requestTimeout: 123,
        },
      },
      apis: {
        filestore: {
          enabled: true,
          url: 'http://filestore.overleaf.production',
        },
      },
    }
    this.latestChunkRequestArgs = sinon.match({
      method: 'GET',
      url: `${this.settings.overleaf.history.host}/projects/${this.historyId}/latest/history`,
      json: true,
      auth: {
        user: this.settings.overleaf.history.user,
        pass: this.settings.overleaf.history.pass,
        sendImmediately: true,
      },
    })

    this.callback = sinon.stub()

    this.LocalFileWriter = {
      bufferOnDisk: sinon.stub(),
    }

    this.WebApiManager = {
      getHistoryId: sinon.stub(),
    }
    this.WebApiManager.getHistoryId
      .withArgs(this.projectId)
      .yields(null, this.historyId)

    this.FetchUtils = {
      fetchStream: sinon.stub(),
      fetchNothing: sinon.stub().resolves(),
      RequestFailedError,
    }

    this.request = sinon.stub()

    this.logger = {
      debug: sinon.stub(),
      warn: sinon.stub(),
    }

    this.HistoryStoreManager = await esmock(MODULE_PATH, {
      '@overleaf/fetch-utils': this.FetchUtils,
      request: this.request,
      '@overleaf/settings': this.settings,
      '../../../../app/js/LocalFileWriter.js': this.LocalFileWriter,
      '../../../../app/js/WebApiManager.js': this.WebApiManager,
      '../../../../app/js/Errors.js': Errors,
      '@overleaf/logger': this.logger,
    })
  })

  describe('getMostRecentChunk', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.chunk = {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {
                files: {},
              },
              changes: [],
            },
          },
        }
        this.request
          .withArgs(this.latestChunkRequestArgs)
          .yields(null, { statusCode: 200 }, this.chunk)
        this.HistoryStoreManager.getMostRecentChunk(
          this.projectId,
          this.historyId,
          this.callback
        )
      })

      it('should call the callback with the chunk', function () {
        expect(this.callback).to.have.been.calledWith(null, this.chunk)
      })
    })
  })

  describe('getMostRecentVersion', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.chunk = {
          chunk: {
            startVersion: 5,
            history: {
              snapshot: {
                files: {},
              },
              changes: [
                { v2Authors: ['5678'], timestamp: '2017-10-17T10:44:40.227Z' },
                { v2Authors: ['1234'], timestamp: '2017-10-16T10:44:40.227Z' },
              ],
            },
          },
        }

        this.request
          .withArgs(this.latestChunkRequestArgs)
          .yields(null, { statusCode: 200 }, this.chunk)
        this.HistoryStoreManager.getMostRecentVersion(
          this.projectId,
          this.historyId,
          this.callback
        )
      })

      it('should call the callback with the latest version information', function () {
        expect(this.callback).to.have.been.calledWith(
          null,
          7,
          { project: undefined, docs: {} },
          { v2Authors: ['5678'], timestamp: '2017-10-17T10:44:40.227Z' }
        )
      })
    })

    describe('out of order doc ops', function () {
      beforeEach(function () {
        this.chunk = {
          chunk: {
            startVersion: 5,
            history: {
              snapshot: {
                v2DocVersions: {
                  mock_doc_id: {
                    pathname: '/main.tex',
                    v: 2,
                  },
                },
              },
              changes: [
                {
                  operations: [],
                  v2DocVersions: {
                    mock_doc_id: {
                      pathname: '/main.tex',
                      v: 1,
                    },
                  },
                },
              ],
            },
          },
        }

        this.request
          .withArgs(this.latestChunkRequestArgs)
          .yields(null, { statusCode: 200 }, this.chunk)
        this.HistoryStoreManager.getMostRecentVersion(
          this.projectId,
          this.historyId,
          this.callback
        )
      })

      it('should return an error', function () {
        expect(this.callback).to.have.been.calledWith(
          sinon.match
            .instanceOf(Errors.OpsOutOfOrderError)
            .and(sinon.match.has('message', 'doc version out of order'))
        )
      })

      it('should call the callback with the latest version information', function () {
        expect(this.callback).to.have.been.calledWith(
          sinon.match.instanceOf(Errors.OpsOutOfOrderError),
          6,
          {
            project: undefined,
            docs: { mock_doc_id: { pathname: '/main.tex', v: 2 } },
          },
          this.chunk.chunk.history.changes[0]
        )
      })
    })

    describe('out of order project structure versions', function () {
      beforeEach(function () {
        this.chunk = {
          chunk: {
            startVersion: 5,
            history: {
              snapshot: {
                projectVersion: 2,
              },
              changes: [
                {
                  operations: [{ pathname: 'main.tex', newPathname: '' }],
                  projectVersion: 1,
                },
              ],
            },
          },
        }

        this.request
          .withArgs(this.latestChunkRequestArgs)
          .yields(null, { statusCode: 200 }, this.chunk)
        this.HistoryStoreManager.getMostRecentVersion(
          this.projectId,
          this.historyId,
          this.callback
        )
      })

      it('should return an error', function () {
        expect(this.callback).to.have.been.calledWith(
          sinon.match
            .instanceOf(Errors.OpsOutOfOrderError)
            .and(
              sinon.match.has(
                'message',
                'project structure version out of order'
              )
            )
        )
      })

      it('should call the callback with the latest version information', function () {
        expect(this.callback).to.have.been.calledWith(
          sinon.match.instanceOf(Errors.OpsOutOfOrderError),
          6,
          { project: 2, docs: {} },
          this.chunk.chunk.history.changes[0]
        )
      })
    })

    describe('out of order project structure and doc versions', function () {
      beforeEach(function () {
        this.chunk = {
          chunk: {
            startVersion: 5,
            history: {
              snapshot: {
                projectVersion: 1,
              },
              changes: [
                {
                  operations: [{ pathname: 'main.tex', newPathname: '' }],
                  projectVersion: 1,
                },
                {
                  operations: [{ pathname: 'main.tex', newPathname: '' }],
                  projectVersion: 2,
                },
                {
                  operations: [{ pathname: 'main.tex', newPathname: '' }],
                  projectVersion: 3,
                },
                {
                  operations: [{ pathname: 'main.tex', newPathname: '' }],
                  projectVersion: 1,
                },
                {
                  operations: [],
                  v2DocVersions: {
                    mock_doc_id: {
                      pathname: '/main.tex',
                      v: 1,
                    },
                  },
                },
                {
                  operations: [],
                  v2DocVersions: {
                    mock_doc_id: {
                      pathname: '/main.tex',
                      v: 2,
                    },
                  },
                },
                {
                  operations: [],
                  v2DocVersions: {
                    mock_doc_id: {
                      pathname: '/main.tex',
                      v: 1,
                    },
                  },
                },
              ],
            },
          },
        }

        this.request
          .withArgs(this.latestChunkRequestArgs)
          .yields(null, { statusCode: 200 }, this.chunk)
        this.HistoryStoreManager.getMostRecentVersion(
          this.projectId,
          this.historyId,
          this.callback
        )
      })

      it('should return an error', function () {
        expect(this.callback).to.have.been.calledWith(
          sinon.match
            .instanceOf(Errors.OpsOutOfOrderError)
            .and(
              sinon.match.has(
                'message',
                'project structure version out of order'
              )
            )
        )
      })

      it('should call the callback with the latest version information', function () {
        expect(this.callback).to.have.been.calledWith(
          sinon.match.instanceOf(Errors.OpsOutOfOrderError),
          12,
          {
            project: 3,
            docs: { mock_doc_id: { pathname: '/main.tex', v: 2 } },
          },
          this.chunk.chunk.history.changes[6]
        )
      })
    })

    describe('with an unexpected response', function () {
      beforeEach(function () {
        this.badChunk = {
          chunk: {
            foo: 123, // valid chunk should have startVersion property
            bar: 456,
          },
        }
        this.request
          .withArgs(this.latestChunkRequestArgs)
          .yields(null, { statusCode: 200 }, this.badChunk)
        this.HistoryStoreManager.getMostRecentVersion(
          this.projectId,
          this.historyId,
          this.callback
        )
      })

      it('should return an error', function () {
        expect(this.callback).to.have.been.calledWith(
          sinon.match
            .instanceOf(Error)
            .and(sinon.match.has('message', 'unexpected response'))
        )
      })
    })
  })

  describe('createBlobForUpdate', function () {
    beforeEach(function () {
      this.fileStream = {}
      this.hash = 'random-hash'
      this.LocalFileWriter.bufferOnDisk.callsArgWith(4, null, this.hash)
      this.FetchUtils.fetchNothing.rejects(
        new RequestFailedError('', {}, { status: 404 })
      )
      this.FetchUtils.fetchStream.resolves(this.fileStream)
    })

    describe('for a file update with any filestore location', function () {
      beforeEach(function (done) {
        this.file_id = '012345678901234567890123'
        this.update = {
          file: true,
          url: `http://filestore.other.cloud.provider/project/${this.projectId}/file/${this.file_id}`,
          hash: this.hash,
        }
        this.HistoryStoreManager.createBlobForUpdate(
          this.projectId,
          this.historyId,
          this.update,
          (err, { file: hash }) => {
            if (err) {
              return done(err)
            }
            this.actualHash = hash
            done()
          }
        )
      })

      it('should not log any warnings', function () {
        expect(this.logger.warn).to.not.have.been.called
      })

      it('should request the file from the filestore in settings', function () {
        expect(this.FetchUtils.fetchStream).to.have.been.calledWithMatch(
          `${this.settings.apis.filestore.url}/project/${this.projectId}/file/${this.file_id}`
        )
      })

      it('should call the callback with the blob', function () {
        expect(this.actualHash).to.equal(this.hash)
      })
    })

    describe('with filestore disabled', function () {
      beforeEach(function (done) {
        this.settings.apis.filestore.enabled = false
        this.file_id = '012345678901234567890123'
        this.update = {
          file: true,
          url: `http://filestore.other.cloud.provider/project/${this.projectId}/file/${this.file_id}`,
          hash: this.hash,
        }
        this.HistoryStoreManager.createBlobForUpdate(
          this.projectId,
          this.historyId,
          this.update,
          err => {
            expect(err).to.match(/blocking filestore read/)
            done()
          }
        )
      })
      it('should not request the file', function () {
        expect(this.FetchUtils.fetchStream).to.not.have.been.called
      })
    })

    describe('for a file update with an invalid filestore location', function () {
      beforeEach(function (done) {
        this.invalid_id = '000000000000000000000000'
        this.file_id = '012345678901234567890123'
        this.update = {
          file: true,
          url: `http://filestore.other.cloud.provider/project/${this.invalid_id}/file/${this.file_id}`,
          hash: this.hash,
        }
        this.HistoryStoreManager.createBlobForUpdate(
          this.projectId,
          this.historyId,
          this.update,
          err => {
            expect(err).to.exist
            done()
          }
        )
      })

      it('should not request the file from the filestore', function () {
        expect(this.FetchUtils.fetchStream).to.not.have.been.called
      })
    })

    describe('when the hash mismatches', function () {
      beforeEach(function (done) {
        this.file_id = '012345678901234567890123'
        this.update = {
          file: true,
          url: `http://filestore.other.cloud.provider/project/${this.projectId}/file/${this.file_id}`,
          hash: 'another-hash-from-web',
        }
        this.HistoryStoreManager.createBlobForUpdate(
          this.projectId,
          this.historyId,
          this.update,
          (err, { file: hash }) => {
            if (err) {
              return done(err)
            }
            this.actualHash = hash
            done()
          }
        )
      })

      it('should log a warning', function () {
        expect(this.logger.warn).to.have.been.calledWith(
          {
            projectId: this.projectId,
            fileId: this.file_id,
            webHash: 'another-hash-from-web',
            fileHash: this.hash,
          },
          'hash mismatch between web and project-history'
        )
      })

      it('should request the file from the filestore in settings', function () {
        expect(this.FetchUtils.fetchStream).to.have.been.calledWithMatch(
          `${this.settings.apis.filestore.url}/project/${this.projectId}/file/${this.file_id}`
        )
      })

      it('should call the callback with the blob', function () {
        expect(this.actualHash).to.equal(this.hash)
      })
    })
    describe('when the createdBlob flag is set on the update', function () {
      beforeEach(function () {
        this.file_id = '012345678901234567890123'
        this.update = {
          file: true,
          createdBlob: true,
          url: `http://filestore.other.cloud.provider/project/${this.projectId}/file/${this.file_id}`,
          hash: this.hash,
        }
      })
      describe('when history-v1 confirms that the blob exists', function () {
        beforeEach(function (done) {
          this.FetchUtils.fetchNothing.resolves()
          this.HistoryStoreManager.createBlobForUpdate(
            this.projectId,
            this.historyId,
            this.update,
            (err, { file: hash }) => {
              if (err) {
                return done(err)
              }
              this.actualHash = hash
              done()
            }
          )
        })

        it('should call the callback with the existing hash', function () {
          expect(this.actualHash).to.equal(this.hash)
        })

        it('should not request the file from the filestore', function () {
          expect(this.FetchUtils.fetchStream).to.not.have.been.called
        })

        it('should log a debug level message', function () {
          expect(this.logger.debug).to.have.been.calledWith(
            {
              projectId: this.projectId,
              fileId: this.file_id,
              update: this.update,
            },
            'Skipping blob creation as it has already been created'
          )
        })
      })
      describe('when history-v1 does not confirm that the blob exists', function () {
        beforeEach(function (done) {
          this.FetchUtils.fetchNothing.rejects(
            new RequestFailedError(
              `${this.settings.overleaf.history.host}/project/${this.projectId}/file/${this.file_id}`,
              { method: 'HEAD' },
              { status: 404 }
            )
          )
          this.HistoryStoreManager.createBlobForUpdate(
            this.projectId,
            this.historyId,
            this.update,
            (err, { file: hash }) => {
              if (err) {
                return done(err)
              }
              this.actualHash = hash
              done()
            }
          )
        })

        it('should warn that we will use the filestore', function () {
          expect(this.logger.warn).to.have.been.calledWithMatch(
            {
              fileId: this.file_id,
              projectId: this.projectId,
              update: this.update,
            },
            'created blob does not exist, reading from filestore'
          )
        })

        it('should request the file from the filestore in settings', function () {
          expect(this.FetchUtils.fetchStream).to.have.been.calledWithMatch(
            `${this.settings.apis.filestore.url}/project/${this.projectId}/file/${this.file_id}`
          )
        })

        it('should call the callback with the blob', function () {
          expect(this.actualHash).to.equal(this.hash)
        })
      })
    })
  })

  describe('getProjectBlob', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.blobContent = 'test content'
        this.blobHash = 'test hash'

        this.request.yields(null, { statusCode: 200 }, this.blobContent)
        this.HistoryStoreManager.getProjectBlob(
          this.historyId,
          this.blobHash,
          this.callback
        )
      })

      it('should get the blob from the overleaf history service', function () {
        expect(this.request).to.have.been.calledWithMatch({
          method: 'GET',
          url: `${this.settings.overleaf.history.host}/projects/${this.historyId}/blobs/${this.blobHash}`,
          auth: {
            user: this.settings.overleaf.history.user,
            pass: this.settings.overleaf.history.pass,
            sendImmediately: true,
          },
        })
      })

      it('should call the callback with the blob', function () {
        expect(this.callback).to.have.been.calledWith(null, this.blobContent)
      })
    })
  })

  describe('getProjectBlobStream', function () {
    describe('successfully', function () {
      beforeEach(function (done) {
        this.historyResponse = new EventEmitter()
        this.blobHash = 'test hash'

        this.FetchUtils.fetchStream.resolves(this.historyResponse)
        this.HistoryStoreManager.getProjectBlobStream(
          this.historyId,
          this.blobHash,
          (err, stream) => {
            if (err) {
              return done(err)
            }
            this.stream = stream
            done()
          }
        )
      })

      it('should get the blob from the overleaf history service', function () {
        expect(this.FetchUtils.fetchStream).to.have.been.calledWithMatch(
          `${this.settings.overleaf.history.host}/projects/${this.historyId}/blobs/${this.blobHash}`
        )
      })

      it('should return a stream of the blob contents', function () {
        expect(this.stream).to.equal(this.historyResponse)
      })
    })
  })

  describe('initializeProject', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.response_body = { projectId: this.historyId }
        this.request.callsArgWith(
          1,
          null,
          { statusCode: 200 },
          this.response_body
        )

        this.HistoryStoreManager.initializeProject(
          this.historyId,
          this.callback
        )
      })

      it('should send the change to the history store', function () {
        expect(this.request).to.have.been.calledWithMatch({
          method: 'POST',
          url: `${this.settings.overleaf.history.host}/projects`,
          auth: {
            user: this.settings.overleaf.history.user,
            pass: this.settings.overleaf.history.pass,
            sendImmediately: true,
          },
          json: { projectId: this.historyId },
        })
      })

      it('should call the callback with the new overleaf id', function () {
        expect(this.callback).to.have.been.calledWith(null, this.historyId)
      })
    })
  })

  describe('deleteProject', function () {
    beforeEach(function (done) {
      this.request.yields(null, { statusCode: 204 }, '')
      this.HistoryStoreManager.deleteProject(this.historyId, done)
    })

    it('should ask the history store to delete the project', function () {
      expect(this.request).to.have.been.calledWithMatch({
        method: 'DELETE',
        url: `${this.settings.overleaf.history.host}/projects/${this.historyId}`,
      })
    })
  })
})
