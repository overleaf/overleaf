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
  let contentRanges, newContentRanges, reclaimed
  function run(filePath, done) {
    ContentCacheManager.update(contentDir, filePath, (err, ranges) => {
      if (err) return done(err)
      let newlyReclaimed
      ;[contentRanges, newContentRanges, newlyReclaimed] = ranges
      reclaimed += newlyReclaimed
      done()
    })
  }

  beforeEach(function () {
    reclaimed = 0
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
        async writeFile(name, blob) {
          const file = new FakeFile()
          await file.write(Buffer.from(blob))
          await file.close()
          files[name] = file
        },
        async readFile(name) {
          if (!files[name]) {
            throw new Error()
          }
          return files[name].toJSON().contents
        },
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
        async unlink(name) {
          if (!files[name]) {
            throw new Error()
          }
          delete files[name]
        }
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
      const RANGE_2 = 'stream(||)endstream'
      const RANGE_3 = 'stream!$%/=endstream'
      const h1 = hash(RANGE_1)
      const h2 = hash(RANGE_2)
      const h3 = hash(RANGE_3)
      function runWithSplitStream(done) {
        fs.createReadStream
          .withArgs(pdfPath)
          .returns(
            Readable.from([
              Buffer.from('abcstr'),
              Buffer.from('eam123endstreamABC'),
              Buffer.from('str'),
              Buffer.from('eam(||'),
              Buffer.from(')end'),
              Buffer.from('stream-_~stream!$%/=endstream')
            ])
          )
        run(pdfPath, done)
      }
      beforeEach(function (done) {
        runWithSplitStream(done)
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
            end: 43,
            hash: hash(RANGE_2)
          },
          {
            start: 46,
            end: 66,
            hash: hash(RANGE_3)
          }
        ])
      })

      it('should store the contents', function () {
        expect(JSON.parse(JSON.stringify(files))).to.deep.equal({
          [Path.join(contentDir, h1)]: {
            contents: RANGE_1,
            closed: true
          },
          [Path.join(contentDir, h2)]: {
            contents: RANGE_2,
            closed: true
          },
          [Path.join(contentDir, h3)]: {
            contents: RANGE_3,
            closed: true
          },
          [Path.join(contentDir, '.state.v0.json')]: {
            contents: JSON.stringify({
              hashAge: [
                [h1, 0],
                [h2, 0],
                [h3, 0]
              ],
              hashSize: [
                [h1, 18],
                [h2, 19],
                [h3, 20]
              ]
            }),
            closed: true
          }
        })
      })

      it('should mark all ranges as new', function () {
        expect(contentRanges).to.deep.equal(newContentRanges)
      })

      describe('when re-running with one stream removed', function () {
        function runWithOneSplitStreamRemoved(done) {
          fs.createReadStream
            .withArgs(pdfPath)
            .returns(
              Readable.from([
                Buffer.from('abcstr'),
                Buffer.from('eam123endstreamABC'),
                Buffer.from('stream!$%/=endstream')
              ])
            )
          run(pdfPath, done)
        }
        beforeEach(function (done) {
          runWithOneSplitStreamRemoved(done)
        })

        it('should produce two ranges', function () {
          expect(contentRanges).to.have.length(2)
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
              end: 44,
              hash: hash(RANGE_3)
            }
          ])
        })

        it('should update the age of the 2nd range', function () {
          expect(JSON.parse(JSON.stringify(files))).to.deep.equal({
            [Path.join(contentDir, h1)]: {
              contents: RANGE_1,
              closed: true
            },
            [Path.join(contentDir, h2)]: {
              contents: RANGE_2,
              closed: true
            },
            [Path.join(contentDir, h3)]: {
              contents: RANGE_3,
              closed: true
            },
            [Path.join(contentDir, '.state.v0.json')]: {
              contents: JSON.stringify({
                hashAge: [
                  [h1, 0],
                  [h2, 1],
                  [h3, 0]
                ],
                hashSize: [
                  [h1, 18],
                  [h2, 19],
                  [h3, 20]
                ]
              }),
              closed: true
            }
          })
        })

        it('should find no new ranges', function () {
          expect(newContentRanges).to.deep.equal([])
        })

        describe('when re-running 5 more times', function () {
          for (let i = 0; i < 5; i++) {
            beforeEach(function (done) {
              runWithOneSplitStreamRemoved(done)
            })
          }

          it('should still produce two ranges', function () {
            expect(contentRanges).to.have.length(2)
          })

          it('should still find the correct offsets', function () {
            expect(contentRanges).to.deep.equal([
              {
                start: 3,
                end: 21,
                hash: hash(RANGE_1)
              },
              {
                start: 24,
                end: 44,
                hash: hash(RANGE_3)
              }
            ])
          })

          it('should delete the 2nd range', function () {
            expect(JSON.parse(JSON.stringify(files))).to.deep.equal({
              [Path.join(contentDir, h1)]: {
                contents: RANGE_1,
                closed: true
              },
              [Path.join(contentDir, h3)]: {
                contents: RANGE_3,
                closed: true
              },
              [Path.join(contentDir, '.state.v0.json')]: {
                contents: JSON.stringify({
                  hashAge: [
                    [h1, 0],
                    [h3, 0]
                  ],
                  hashSize: [
                    [h1, 18],
                    [h3, 20]
                  ]
                }),
                closed: true
              }
            })
          })

          it('should find no new ranges', function () {
            expect(newContentRanges).to.deep.equal([])
          })

          it('should yield the reclaimed space', function () {
            expect(reclaimed).to.equal(RANGE_2.length)
          })
        })
      })
    })
  })
})
