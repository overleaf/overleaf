'use strict'

const _ = require('lodash')
const BPromise = require('bluebird')
const { expect } = require('chai')
const fs = BPromise.promisifyAll(require('node:fs'))
const sinon = require('sinon')
const stream = require('node:stream')
const temp = require('temp')

const cleanup = require('./support/cleanup')
const fixtures = require('./support/fixtures')
const testFiles = require('./support/test_files')
const unzip = require('./support/unzip')

const core = require('overleaf-editor-core')
const File = core.File
const Snapshot = core.Snapshot

const storage = require('../../../../storage')
const BlobStore = storage.BlobStore
const ProjectArchive = storage.ProjectArchive

describe('ProjectArchive', function () {
  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)

  const projectId = '123'
  const blobStore = new BlobStore(projectId)

  let zipFilePath
  beforeEach(function () {
    zipFilePath = temp.path({ suffix: '.zip' })
  })
  afterEach(function () {
    return fs.unlinkAsync(zipFilePath).catch(() => {})
  })

  function makeMixedTestSnapshot(rounds) {
    const snapshot = new Snapshot()

    return blobStore.putFile(testFiles.path('graph.png')).then(() => {
      _.times(rounds, i => {
        snapshot.addFile('test' + i + '.txt', File.fromString('test'))
        snapshot.addFile(
          'graph' + i + '.png',
          File.fromHash(testFiles.GRAPH_PNG_HASH)
        )
      })
      return snapshot
    })
  }

  function makeTextTestSnapshot(rounds) {
    const snapshot = new Snapshot()
    _.times(rounds, i => {
      snapshot.addFile('test' + i + '.txt', File.fromString('test'))
    })
    return snapshot
  }

  it('archives a small snapshot with binary and text data', function () {
    return makeMixedTestSnapshot(1)
      .then(snapshot => {
        const projectArchive = new ProjectArchive(snapshot)
        return projectArchive.writeZip(blobStore, zipFilePath)
      })
      .then(() => {
        return unzip.getZipEntries(zipFilePath)
      })
      .then(zipEntries => {
        expect(zipEntries).to.have.length(2)
        zipEntries = _.sortBy(zipEntries, 'fileName')
        expect(zipEntries[0].fileName).to.equal('graph0.png')
        expect(zipEntries[0].uncompressedSize).to.equal(
          testFiles.GRAPH_PNG_BYTE_LENGTH
        )
        expect(zipEntries[1].fileName).to.equal('test0.txt')
        expect(zipEntries[1].uncompressedSize).to.equal(4)
      })
  })

  it('archives a larger snapshot with binary and text data', function () {
    return makeMixedTestSnapshot(10)
      .then(snapshot => {
        const projectArchive = new ProjectArchive(snapshot)
        return projectArchive.writeZip(blobStore, zipFilePath)
      })
      .then(() => {
        return unzip.getZipEntries(zipFilePath)
      })
      .then(zipEntries => {
        expect(zipEntries).to.have.length(20)
      })
  })

  it('archives empty files', function () {
    const snapshot = new Snapshot()
    snapshot.addFile('test0', File.fromString(''))
    snapshot.addFile('test1', File.fromHash(File.EMPTY_FILE_HASH))

    return blobStore
      .putString('')
      .then(() => {
        const projectArchive = new ProjectArchive(snapshot)
        return projectArchive.writeZip(blobStore, zipFilePath)
      })
      .then(() => {
        return unzip.getZipEntries(zipFilePath)
      })
      .then(zipEntries => {
        zipEntries = _.sortBy(zipEntries, 'fileName')
        expect(zipEntries[0].fileName).to.equal('test0')
        expect(zipEntries[0].uncompressedSize).to.equal(0)
        expect(zipEntries[1].fileName).to.equal('test1')
        expect(zipEntries[1].uncompressedSize).to.equal(0)
      })
  })

  describe('with a blob stream download error', function () {
    beforeEach(function () {
      const testStream = new stream.Readable({
        read: function () {
          testStream.destroy(new Error('test read error'))
        },
      })
      sinon.stub(blobStore, 'getStream').resolves(testStream)
    })

    afterEach(function () {
      blobStore.getStream.restore()
    })

    it('rejects with the error', function () {
      return makeMixedTestSnapshot(1)
        .then(snapshot => {
          const projectArchive = new ProjectArchive(snapshot)
          return projectArchive.writeZip(blobStore, zipFilePath)
        })
        .then(() => {
          expect.fail()
        })
        .catch(err => {
          let message = err.message
          if (err instanceof ProjectArchive.DownloadError) {
            message = err.cause.message
          }
          expect(message).to.match(/test read error/)
        })
    })
  })

  describe('with zip write error', function () {
    beforeEach(function () {
      sinon.stub(fs, 'createWriteStream').callsFake(path => {
        const testStream = new stream.Writable({
          write: function (chunk, encoding, callback) {
            callback(new Error('test write error'))
          },
        })
        return testStream
      })
    })

    afterEach(function () {
      fs.createWriteStream.restore()
    })

    it('rejects with the error', function () {
      return makeMixedTestSnapshot(1)
        .then(snapshot => {
          const projectArchive = new ProjectArchive(snapshot)
          return projectArchive.writeZip(blobStore, zipFilePath)
        })
        .then(() => {
          expect.fail()
        })
        .catch(err => {
          expect(err.message).to.equal('test write error')
        })
    })
  })

  describe('with a delayed file load', function () {
    beforeEach(function () {
      sinon.stub(File.prototype, 'load').callsFake(function () {
        return BPromise.delay(200).thenReturn(this)
      })
    })

    afterEach(function () {
      File.prototype.load.restore()
    })

    it('times out', function () {
      const snapshot = makeTextTestSnapshot(10)
      const projectArchive = new ProjectArchive(snapshot, 100)
      return projectArchive
        .writeZip(blobStore, zipFilePath)
        .then(() => {
          expect.fail()
        })
        .catch(err => {
          expect(err.name).to.equal('ArchiveTimeout')
        })
    })
  })
})
