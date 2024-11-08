const fs = require('node:fs')
const Path = require('node:path')
const { expect } = require('chai')

const MODULE_PATH = '../../../app/js/ContentCacheManager'

describe('ContentCacheManager', function () {
  let contentDir, pdfPath, xrefPath
  let ContentCacheManager, files, Settings
  before(function () {
    Settings = require('@overleaf/settings')
    ContentCacheManager = require(MODULE_PATH)
  })
  let contentRanges, newContentRanges, reclaimed
  async function run(filePath, pdfSize, pdfCachingMinChunkSize) {
    const result = await ContentCacheManager.promises.update({
      contentDir,
      filePath,
      pdfSize,
      pdfCachingMinChunkSize,
      compileTime: 1337,
    })
    let newlyReclaimed
    ;({
      contentRanges,
      newContentRanges,
      reclaimedSpace: newlyReclaimed,
    } = result)
    reclaimed += newlyReclaimed

    const fileNames = await fs.promises.readdir(contentDir)
    files = {}
    for (const fileName of fileNames) {
      const path = Path.join(contentDir, fileName)
      files[path] = await fs.promises.readFile(path)
    }
  }
  before(function () {
    contentDir =
      '/overleaf/services/clsi/output/602cee6f6460fca0ba7921e6/content/1797a7f48f9-5abc1998509dea1f'
    pdfPath =
      '/overleaf/services/clsi/output/602cee6f6460fca0ba7921e6/generated-files/1797a7f48ea-8ac6805139f43351/output.pdf'
    xrefPath =
      '/overleaf/services/clsi/output/602cee6f6460fca0ba7921e6/generated-files/1797a7f48ea-8ac6805139f43351/output.pdfxref'

    reclaimed = 0
    Settings.pdfCachingMinChunkSize = 1024
  })

  before(async function () {
    await fs.promises.rm(contentDir, { recursive: true, force: true })
    await fs.promises.mkdir(contentDir, { recursive: true })
    await fs.promises.mkdir(Path.dirname(pdfPath), { recursive: true })
  })

  describe('minimal', function () {
    const PATH_MINIMAL_PDF = 'test/acceptance/fixtures/minimal.pdf'
    const PATH_MINIMAL_XREF = 'test/acceptance/fixtures/minimal.pdfxref'
    const OBJECT_ID_1 = '9 0 '
    const HASH_LARGE =
      'd7cfc73ad2fba4578a437517923e3714927bbf35e63ea88bd93c7a8076cf1fcd'
    const OBJECT_ID_2 = '10 0 '
    const HASH_SMALL =
      '896749b8343851b0dc385f71616916a7ba0434fcfb56d1fc7e27cd139eaa2f71'
    function getChunkPath(hash) {
      return Path.join('test/unit/js/snapshots/minimalCompile/chunks', hash)
    }
    let MINIMAL_SIZE, RANGE_1, RANGE_2, h1, h2, START_1, START_2, END_1, END_2
    before(async function () {
      await fs.promises.copyFile(PATH_MINIMAL_PDF, pdfPath)
      await fs.promises.copyFile(PATH_MINIMAL_XREF, xrefPath)
      const MINIMAL = await fs.promises.readFile(PATH_MINIMAL_PDF)
      MINIMAL_SIZE = (await fs.promises.stat(PATH_MINIMAL_PDF)).size
      RANGE_1 = await fs.promises.readFile(getChunkPath(HASH_LARGE))
      RANGE_2 = await fs.promises.readFile(getChunkPath(HASH_SMALL))
      h1 = HASH_LARGE
      h2 = HASH_SMALL
      START_1 = MINIMAL.indexOf(RANGE_1)
      END_1 = START_1 + RANGE_1.byteLength
      START_2 = MINIMAL.indexOf(RANGE_2)
      END_2 = START_2 + RANGE_2.byteLength
    })
    async function runWithMinimal(pdfCachingMinChunkSize) {
      await run(pdfPath, MINIMAL_SIZE, pdfCachingMinChunkSize)
    }

    describe('with two ranges qualifying', function () {
      before(async function () {
        await runWithMinimal(500)
      })
      it('should produce two ranges', function () {
        expect(contentRanges).to.have.length(2)
      })

      it('should find the correct offsets', function () {
        expect(contentRanges).to.deep.equal([
          {
            objectId: OBJECT_ID_1,
            start: START_1,
            end: END_1,
            hash: h1,
          },
          {
            objectId: OBJECT_ID_2,
            start: START_2,
            end: END_2,
            hash: h2,
          },
        ])
      })

      it('should store the contents', function () {
        expect(files).to.deep.equal({
          [Path.join(contentDir, h1)]: RANGE_1,
          [Path.join(contentDir, h2)]: RANGE_2,
          [Path.join(contentDir, '.state.v0.json')]: Buffer.from(
            JSON.stringify({
              hashAge: [
                [h1, 0],
                [h2, 0],
              ],
              hashSize: [
                [h1, RANGE_1.byteLength],
                [h2, RANGE_2.byteLength],
              ],
            })
          ),
        })
      })

      it('should mark all ranges as new', function () {
        expect(contentRanges).to.deep.equal(newContentRanges)
      })

      describe('when re-running with one range too small', function () {
        before(async function () {
          await runWithMinimal(1024)
        })

        it('should produce one range', function () {
          expect(contentRanges).to.have.length(1)
        })

        it('should find the correct offsets', function () {
          expect(contentRanges).to.deep.equal([
            {
              objectId: OBJECT_ID_1,
              start: START_1,
              end: END_1,
              hash: h1,
            },
          ])
        })

        it('should update the age of the 2nd range', function () {
          expect(files).to.deep.equal({
            [Path.join(contentDir, h1)]: RANGE_1,
            [Path.join(contentDir, h2)]: RANGE_2,
            [Path.join(contentDir, '.state.v0.json')]: Buffer.from(
              JSON.stringify({
                hashAge: [
                  [h1, 0],
                  [h2, 1],
                ],
                hashSize: [
                  [h1, RANGE_1.byteLength],
                  [h2, RANGE_2.byteLength],
                ],
              })
            ),
          })
        })

        it('should find no new ranges', function () {
          expect(newContentRanges).to.deep.equal([])
        })

        describe('when re-running 5 more times', function () {
          for (let i = 0; i < 5; i++) {
            before(async function () {
              await runWithMinimal(1024)
            })
          }

          it('should still produce one range', function () {
            expect(contentRanges).to.have.length(1)
          })

          it('should still find the correct offsets', function () {
            expect(contentRanges).to.deep.equal([
              {
                objectId: OBJECT_ID_1,
                start: START_1,
                end: END_1,
                hash: h1,
              },
            ])
          })

          it('should delete the 2nd range', function () {
            expect(files).to.deep.equal({
              [Path.join(contentDir, h1)]: RANGE_1,
              [Path.join(contentDir, '.state.v0.json')]: Buffer.from(
                JSON.stringify({
                  hashAge: [[h1, 0]],
                  hashSize: [[h1, RANGE_1.byteLength]],
                })
              ),
            })
          })

          it('should find no new ranges', function () {
            expect(newContentRanges).to.deep.equal([])
          })

          it('should yield the reclaimed space', function () {
            expect(reclaimed).to.equal(RANGE_2.byteLength)
          })
        })
      })
    })
  })
})
