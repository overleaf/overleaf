const fs = require('node:fs')
const path = require('node:path')
const { expect } = require('chai')
const { addLatexFdbMetrics } = require('../../../app/js/LatexMetrics')

describe('LatexMetrics', function () {
  describe('addLatexFdbMetrics', function () {
    beforeEach(function () {
      this.stats = {}
      Object.defineProperty(this.stats, 'latexmk', {
        value: {},
        enumerable: false,
      })
    })

    it('should do nothing if fdbContent is null or empty', function () {
      addLatexFdbMetrics(null, this.stats)
      expect(this.stats.latexmk).to.deep.equal({})
      addLatexFdbMetrics('', this.stats)
      expect(this.stats.latexmk).to.deep.equal({})
    })

    it('should parse v3 fdb content and add to stats', function () {
      const fdbContent = fs.readFileSync(
        path.join(__dirname, 'fixtures', 'v3.fdb_latexmk'),
        'utf8'
      )
      addLatexFdbMetrics(fdbContent, this.stats)
      expect(this.stats.latexmk['fdb-file-types']).to.deep.equal({
        system: [
          { ext: 'fmt', count: 1, size: 3847283 },
          { ext: 'map', count: 2, size: 1644257 },
          { ext: 'pfb', count: 12, size: 404691 },
          { ext: 'sty', count: 19, size: 209868 },
          { ext: 'mkii', count: 1, size: 71627 },
          { ext: 'def', count: 1, size: 55368 },
          { ext: 'cnf', count: 2, size: 32268 },
          { ext: 'bst', count: 1, size: 24635 },
          { ext: 'tfm', count: 16, size: 20608 },
          { ext: 'cls', count: 1, size: 20496 },
          { ext: 'clo', count: 1, size: 8967 },
          { ext: 'cfg', count: 2, size: 4241 },
          { ext: 'fd', count: 2, size: 4089 },
        ],
        user: [
          { ext: 'png', count: 2, size: 3886031 },
          { ext: 'tex', count: 1, size: 6147 },
          { ext: 'aux', count: 1, size: 1080 },
          { ext: 'bib', count: 1, size: 230 },
          { ext: 'bbl', count: 1, size: 203 },
        ],
        total: {
          fontFileCount: 0,
          fontFileSize: 0,
          imageFileCount: 2,
          imageFileSize: 3886031,
          otherFileCount: 2,
          otherFileSize: 1283,
          systemFileCount: 61,
          systemFileSize: 6348398,
          textFileCount: 2,
          textFileSize: 6377,
        },
      })
    })

    it('should parse v4 fdb content and add to stats', function () {
      const fdbContent = fs.readFileSync(
        path.join(__dirname, 'fixtures', 'v4.fdb_latexmk'),
        'utf8'
      )
      addLatexFdbMetrics(fdbContent, this.stats)
      expect(this.stats.latexmk['fdb-file-types']).to.deep.equal({
        system: [
          { ext: 'fmt', count: 1, size: 8172536 },
          { ext: 'map', count: 2, size: 4652176 },
          { ext: 'pfb', count: 13, size: 542949 },
          { ext: 'sty', count: 9, size: 100959 },
          { ext: 'mkii', count: 1, size: 71627 },
          { ext: 'def', count: 2, size: 49388 },
          { ext: 'cnf', count: 2, size: 41037 },
          { ext: 'bst', count: 1, size: 24635 },
          { ext: 'tfm', count: 17, size: 22144 },
          { ext: 'cls', count: 1, size: 20144 },
          { ext: 'clo', count: 1, size: 8448 },
          { ext: 'enc', count: 1, size: 2900 },
          { ext: 'fd', count: 1, size: 2470 },
          { ext: 'cfg', count: 2, size: 1902 },
        ],
        user: [
          { ext: 'png', count: 2, size: 3886031 },
          { ext: 'tex', count: 1, size: 6147 },
          { ext: 'aux', count: 1, size: 1382 },
          { ext: 'bib', count: 1, size: 230 },
          { ext: 'bbl', count: 1, size: 203 },
        ],
        total: {
          fontFileCount: 0,
          fontFileSize: 0,
          imageFileCount: 2,
          imageFileSize: 3886031,
          otherFileCount: 2,
          otherFileSize: 1585,
          systemFileCount: 54,
          systemFileSize: 13713315,
          textFileCount: 2,
          textFileSize: 6377,
        },
      })
    })
  })
})
