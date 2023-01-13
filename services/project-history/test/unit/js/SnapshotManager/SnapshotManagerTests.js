/* eslint-disable
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import { expect } from 'chai'
import { strict as esmock } from 'esmock'
import Core from 'overleaf-editor-core'
import BPromise from 'bluebird'
import * as Errors from '../../../../app/js/Errors.js'

const MODULE_PATH = '../../../../app/js/SnapshotManager.js'

describe('SnapshotManager', function () {
  beforeEach(async function () {
    this.HistoryStoreManager = {
      getBlobStore: sinon.stub(),
      getChunkAtVersion: sinon.stub(),
      getMostRecentChunk: sinon.stub(),
      getProjectBlobStream: sinon.stub(),
    }
    this.WebApiManager = {
      getHistoryId: sinon.stub(),
    }
    this.SnapshotManager = await esmock(MODULE_PATH, {
      'overleaf-editor-core': Core,
      '../../../../app/js/HistoryStoreManager.js': this.HistoryStoreManager,
      '../../../../app/js/WebApiManager.js': this.WebApiManager,
      '../../../../app/js/Errors.js': Errors,
    })
    this.projectId = 'project-id-123'
    this.historyId = 'ol-project-id-123'
    return (this.callback = sinon.stub())
  })

  describe('getFileSnapshotStream', function () {
    beforeEach(function () {
      this.WebApiManager.getHistoryId.yields(null, this.historyId)
      return this.HistoryStoreManager.getChunkAtVersion.yields(null, {
        chunk: {
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
        },
      })
    })

    describe('of a text file', function () {
      beforeEach(function (done) {
        this.HistoryStoreManager.getBlobStore.withArgs(this.historyId).returns({
          getString: BPromise.promisify(
            (this.getString = sinon.stub().yields(
              null,
              `\
Hello world

One two three

Four five six\
`.replace(/^\t/g, '')
            ))
          ),
        })
        this.SnapshotManager.getFileSnapshotStream(
          this.projectId,
          5,
          'main.tex',
          (error, stream) => {
            this.stream = stream
            return done(error)
          }
        )
      })

      it('should get the overleaf id', function () {
        return this.WebApiManager.getHistoryId
          .calledWith(this.projectId)
          .should.equal(true)
      })

      it('should get the chunk', function () {
        return this.HistoryStoreManager.getChunkAtVersion
          .calledWith(this.projectId, this.historyId, 5)
          .should.equal(true)
      })

      it('should get the blob of the starting snapshot', function () {
        return this.getString
          .calledWith('35c9bd86574d61dcadbce2fdd3d4a0684272c6ea')
          .should.equal(true)
      })

      it('should return a string stream with the text content', function () {
        return expect(this.stream.read().toString()).to.equal(
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
              getString: BPromise.promisify(sinon.stub().throws(this.error)),
            })
        })

        it('should call back with error', function (done) {
          this.SnapshotManager.getFileSnapshotStream(
            this.projectId,
            5,
            'main.tex',
            error => {
              expect(error).to.exist
              expect(error.name).to.equal(this.error.name)
              done()
            }
          )
        })
      })
    })

    describe('of a binary file', function () {
      beforeEach(function (done) {
        this.HistoryStoreManager.getProjectBlobStream
          .withArgs(this.historyId)
          .yields(null, (this.stream = 'mock-stream'))
        return this.SnapshotManager.getFileSnapshotStream(
          this.projectId,
          5,
          'binary.png',
          (error, returnedStream) => {
            this.returnedStream = returnedStream
            return done(error)
          }
        )
      })

      it('should get the overleaf id', function () {
        return this.WebApiManager.getHistoryId
          .calledWith(this.projectId)
          .should.equal(true)
      })

      it('should get the chunk', function () {
        return this.HistoryStoreManager.getChunkAtVersion
          .calledWith(this.projectId, this.historyId, 5)
          .should.equal(true)
      })

      it('should get the blob of the starting snapshot', function () {
        return this.HistoryStoreManager.getProjectBlobStream
          .calledWith(
            this.historyId,
            'c6654ea913979e13e22022653d284444f284a172'
          )
          .should.equal(true)
      })

      return it('should return a stream with the blob content', function () {
        return expect(this.returnedStream).to.equal(this.stream)
      })
    })

    return describe("when the file doesn't exist", function () {
      beforeEach(function (done) {
        return this.SnapshotManager.getFileSnapshotStream(
          this.projectId,
          5,
          'not-here.png',
          (error, returnedStream) => {
            this.error = error
            this.returnedStream = returnedStream
            return done()
          }
        )
      })

      return it('should return a NotFoundError', function () {
        expect(this.error).to.exist
        expect(this.error.message).to.equal('not-here.png not found')
        return expect(this.error).to.be.an.instanceof(Errors.NotFoundError)
      })
    })
  })

  describe('getProjectSnapshot', function () {
    beforeEach(function () {
      this.WebApiManager.getHistoryId.yields(null, this.historyId)
      return this.HistoryStoreManager.getChunkAtVersion.yields(null, {
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
    })

    describe('of project', function () {
      beforeEach(function (done) {
        this.HistoryStoreManager.getBlobStore.withArgs(this.historyId).returns({
          getString: BPromise.promisify(
            (this.getString = sinon.stub().yields(
              null,
              `\
Hello world

One two three

Four five six\
`.replace(/^\t/g, '')
            ))
          ),
        })
        this.SnapshotManager.getProjectSnapshot(
          this.projectId,
          5,
          (error, data) => {
            this.data = data
            done(error)
          }
        )
      })

      it('should get the overleaf id', function () {
        return this.WebApiManager.getHistoryId
          .calledWith(this.projectId)
          .should.equal(true)
      })

      it('should get the chunk', function () {
        return this.HistoryStoreManager.getChunkAtVersion
          .calledWith(this.projectId, this.historyId, 5)
          .should.equal(true)
      })

      return it('should produce the snapshot file data', function () {
        expect(this.data).to.have.all.keys(['files', 'projectId'])
        expect(this.data.projectId).to.equal('project-id-123')
        expect(this.data.files['main.tex']).to.exist
        expect(this.data.files['unchanged.tex']).to.exist
        expect(this.data.files['binary.png']).to.exist
        // files with operations in the chunk should return content only
        expect(this.data.files['main.tex'].data.content).to.equal(
          'Hello world\n\nOne two three\n\nFour five six\n\nSeven eight nine'
        )
        expect(this.data.files['main.tex'].data.hash).to.not.exist
        // unchanged files in the chunk should return hash only
        expect(this.data.files['unchanged.tex'].data.hash).to.equal(
          '35c9bd86574d61dcadbce2fdd3d4a0684272c6ea'
        )
        expect(this.data.files['unchanged.tex'].data.content).to.not.exist
        return expect(this.data.files['binary.png'].data.hash).to.equal(
          'c6654ea913979e13e22022653d284444f284a172'
        )
      })
    })

    describe('on blob store error', function () {
      beforeEach(function () {
        this.error = new Error('ESOCKETTIMEDOUT')
        this.HistoryStoreManager.getBlobStore.withArgs(this.historyId).returns({
          getString: BPromise.promisify(sinon.stub().yields(this.error)),
        })
      })

      it('should call back with error', function (done) {
        this.SnapshotManager.getProjectSnapshot(this.projectId, 5, error => {
          expect(error).to.exist
          expect(error.message).to.equal(this.error.message)

          done()
        })
      })
    })
  })

  return describe('getLatestSnapshot', function () {
    describe('for a project', function () {
      beforeEach(function (done) {
        this.HistoryStoreManager.getMostRecentChunk.yields(null, {
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
          getString: BPromise.promisify(
            (this.getString = sinon.stub().yields(
              null,
              `\
Hello world

One two three

Four five six\
`.replace(/^\t/g, '')
            ))
          ),
        })
        this.SnapshotManager.getLatestSnapshot(
          this.projectId,
          this.historyId,
          (error, data) => {
            this.data = data
            done(error)
          }
        )
      })

      it('should get the chunk', function () {
        return this.HistoryStoreManager.getMostRecentChunk
          .calledWith(this.projectId, this.historyId)
          .should.equal(true)
      })

      return it('should produce the snapshot file data', function () {
        expect(this.data).to.have.all.keys(['main.tex', 'binary.png'])
        expect(this.data['main.tex']).to.exist
        expect(this.data['binary.png']).to.exist
        expect(this.data['main.tex'].getStringLength()).to.equal(59)
        expect(this.data['binary.png'].getByteLength()).to.equal(41)
        return expect(this.data['binary.png'].getHash()).to.equal(
          'c6654ea913979e13e22022653d284444f284a172'
        )
      })
    })

    return describe('when the chunk is empty', function () {
      beforeEach(function (done) {
        this.HistoryStoreManager.getMostRecentChunk.yields(null)
        return this.SnapshotManager.getLatestSnapshot(
          this.projectId,
          this.historyId,
          (error, data) => {
            this.error = error
            this.data = data
            return done()
          }
        )
      })

      it('should get the chunk', function () {
        return this.HistoryStoreManager.getMostRecentChunk
          .calledWith(this.projectId, this.historyId)
          .should.equal(true)
      })

      return it('return an error', function () {
        expect(this.error).to.exist
        return expect(this.error.message).to.equal('undefined chunk')
      })
    })
  })
})
