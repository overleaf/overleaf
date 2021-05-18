const Path = require('path')
const crypto = require('crypto')
const { Readable } = require('stream')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')

const MODULE_PATH = '../../../app/js/ContentCacheManager'

class FakeFile {
  constructor() {
    this.closed = false
    this.contents = []
  }

  async write(blob) {
    this.contents.push(blob)
    return this
  }

  async close() {
    this.closed = true
    return this
  }

  toJSON() {
    return {
      contents: Buffer.concat(this.contents).toString(),
      closed: this.closed
    }
  }
}

function hash(blob) {
  const hash = crypto.createHash('sha256')
  hash.update(blob)
  return hash.digest('hex')
}

describe('ContentCacheManager', function () {
  let contentDir, pdfPath
  let ContentCacheManager, fs, files, Settings
  function load() {
    ContentCacheManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        fs,
        'settings-sharelatex': Settings
      }
    })
  }
  let contentRanges, newContentRanges
  function run(filePath, done) {
    ContentCacheManager.update(contentDir, filePath, (err, ranges) => {
      if (err) return done(err)
      ;[contentRanges, newContentRanges] = ranges
      done()
    })
  }

  beforeEach(function () {
    contentDir =
      '/app/output/602cee6f6460fca0ba7921e6/content/1797a7f48f9-5abc1998509dea1f'
    pdfPath =
      '/app/output/602cee6f6460fca0ba7921e6/generated-files/1797a7f48ea-8ac6805139f43351/output.pdf'
    Settings = {
      pdfCachingMinChunkSize: 1024,
      enablePdfCachingDark: false
    }
    files = {}
    fs = {
      createReadStream: sinon.stub().returns(Readable.from([])),
      promises: {
        async open(name) {
          files[name] = new FakeFile()
          return files[name]
        },
        async stat(name) {
          if (!files[name]) {
            throw new Error()
          }
        },
        async rename(oldName, newName) {
          if (!files[oldName]) {
            throw new Error()
          }
          files[newName] = files[oldName]
          delete files[oldName]
        },
        unlink: sinon.stub().resolves()
      }
    }
  })

  describe('with a small minChunkSize', function () {
    beforeEach(function () {
      Settings.pdfCachingMinChunkSize = 1
      load()
    })

    describe('when the ranges are split across chunks', function () {
      const RANGE_1 = 'stream123endstream'
      const RANGE_2 = 'stream(|)endstream'
      const RANGE_3 = 'stream!$%endstream'
      beforeEach(function (done) {
        fs.createReadStream
          .withArgs(pdfPath)
          .returns(
            Readable.from([
              Buffer.from('abcstr'),
              Buffer.from('eam123endstreamABC'),
              Buffer.from('str'),
              Buffer.from('eam(|'),
              Buffer.from(')end'),
              Buffer.from('stream-_~stream!$%endstream')
            ])
          )
        run(pdfPath, done)
      })

      it('should produce three ranges', function () {
        expect(contentRanges).to.have.length(3)
      })

      it('should find the correct offsets', function () {
        expect(contentRanges).to.deep.equal([
          {
            start: 3,
            end: 21,
            hash: hash(RANGE_1)
          },
          {
            start: 24,
            end: 42,
            hash: hash(RANGE_2)
          },
          {
            start: 45,
            end: 63,
            hash: hash(RANGE_3)
          }
        ])
      })

      it('should store the contents', function () {
        expect(JSON.parse(JSON.stringify(files))).to.deep.equal({
          [Path.join(contentDir, hash(RANGE_1))]: {
            contents: RANGE_1,
            closed: true
          },
          [Path.join(contentDir, hash(RANGE_2))]: {
            contents: RANGE_2,
            closed: true
          },
          [Path.join(contentDir, hash(RANGE_3))]: {
            contents: RANGE_3,
            closed: true
          }
        })
      })

      it('should mark all ranges as new', function () {
        expect(contentRanges).to.deep.equal(newContentRanges)
      })
    })
  })
})
